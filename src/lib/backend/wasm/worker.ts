/// <reference lib="webworker" />
import * as Comlink from 'comlink'
import type {
  ArkInfo,
  Balance,
  Config,
  EmergencyExitFeeEstimate,
  ExitState,
  ExitVtxo,
  FeeEstimate,
  FeeRates,
  LightningInvoice,
  LightningSendStatus,
  Movement,
  Network,
  NotificationHolder,
  OffboardResult,
  OnchainBalance,
  OnchainUtxo,
  PendingBoard,
  RoundState,
  Vtxo,
  WalletNotification,
  WalletTransaction
} from '@secondts/bark'
import init, { extractTxFromPsbt, OnchainWallet, Wallet } from '@secondts/bark/web'
import { createClaimWatcher } from '@/lib/backend/wasm/claim-watcher'
import { instrumentApi } from '@/lib/backend/wasm/diagnostics-instrument'
import { createDiagnosticsLog, describeError } from '@/lib/backend/wasm/diagnostics-log'
import { deleteDatabase, hasDatabase } from '@/lib/backend/wasm/idb'
import { collectPendingRoundInputVtxoIds } from '@/lib/backend/wasm/round-inputs'

// The Wallet + OnchainWallet handles are non-serializable WASM objects, so they
// can never cross `postMessage`. They live here, in the worker, and the main
// thread drives them through this Comlink-exposed RPC surface. Every method
// returns plain data (or nothing), which structured-clones cleanly.

interface OpenArgs {
  network: Network
  mnemonic: string
  config: Config
  onchainDbName: string
  createIfNotExists: boolean
  restore: boolean
}

interface OpenResult {
  fingerprint: string
  scanIncomplete: boolean
}

// Vite resolves `@secondts/bark` to its `web` target (via the package's
// `browser` export condition), which does NOT auto-initialize the WASM module —
// its default export must be awaited before any Wallet/OnchainWallet call, or
// the wasm-bindgen glue dereferences an undefined module. `init()` fetches and
// instantiates `bark_ffi_wasm_bg.wasm` inside this worker realm; it is cached so
// concurrent/repeated opens instantiate once.
let wasmReady: Promise<unknown> | null = null

const DIAGNOSTICS_CAPACITY = 2000

const diagnostics = createDiagnosticsLog(DIAGNOSTICS_CAPACITY)

async function ensureWasm(): Promise<void> {
  const pending = (wasmReady ??= init())
  try {
    await pending
  } catch (error) {
    // Drop a rejected init from the cache (unless a retry already replaced it),
    // or one transient fetch failure would fail every wallet operation for the
    // life of the worker.
    if (wasmReady === pending) {
      wasmReady = null
    }
    diagnostics.append('error', `wasm init failed: ${describeError(error)}`)
    throw error
  }
}

let wallet: Wallet | null = null
let onchain: OnchainWallet | null = null
let sessionMnemonic: string | null = null
let openPromise: Promise<OpenResult> | null = null
// The mnemonic behind the in-flight openPromise, so a concurrent open with a
// different seed is rejected instead of silently receiving the wrong wallet.
let openingMnemonic: string | null = null

// A generation counter (not a boolean) keyed to each subscription: a fast
// unsubscribe/resubscribe bumps the generation, so a still-draining old loop
// sees the mismatch and exits instead of being revived alongside the new one.
let notificationGeneration = 0
let notificationHolder: NotificationHolder | null = null

// Safety-net sync loop. `runDaemon: true` should keep the wallet synced, but the
// bindings' docs disagree on whether the background daemon runs in the browser,
// so we also drive `sync()` periodically. bark skips a sync while one is already
// in flight, so this never conflicts with the daemon; errors are swallowed so a
// transient failure does not kill the loop.
const SYNC_INTERVAL_MS = 20_000
let syncTimer: ReturnType<typeof setTimeout> | null = null

function requireWallet(): Wallet {
  if (wallet === null) {
    throw new Error('Wallet is not open')
  }
  return wallet
}

// Expired-coin calls: added to bark-ffi after 0.24.0, so they are found
// at runtime until bark-web pins a release that has them.
interface WasmServerVtxoStatus {
  vtxoId: string
  state: string
}

interface WasmExpiryPayout {
  vtxoId: string
  txid: string
  vout: number
  amountSat: number
}

interface WasmExpiryPayoutSweep {
  txid: string
  sweptSat: number
}

interface ExpiryPayoutBindings {
  adoptServerVtxoStatus(vtxoIds: string[]): Promise<WasmServerVtxoStatus[]>
  findExpiryPayouts(): Promise<WasmExpiryPayout[]>
  sweepExpiryPayouts(feeRateSatPerVb: number): Promise<WasmExpiryPayoutSweep>
}

function hasExpiryPayoutBindings(value: object): value is ExpiryPayoutBindings {
  return (
    'adoptServerVtxoStatus' in value &&
    'findExpiryPayouts' in value &&
    'sweepExpiryPayouts' in value
  )
}

function requireExpiryPayoutBindings(): ExpiryPayoutBindings {
  const w = requireWallet()
  if (!hasExpiryPayoutBindings(w)) {
    throw new Error('This bark build cannot look up expired-coin payouts')
  }
  return w
}

function requireOnchain(): OnchainWallet {
  if (onchain === null) {
    throw new Error('Onchain wallet is not open')
  }
  return onchain
}

// `sync()` claims lightning receives one state step per pass; the watcher
// re-drives them every 4s while any are pending. bark holds a per-action lock,
// so overlapping with an in-flight sync is harmless.
const claimWatcher = createClaimWatcher({
  claimAll: async () => {
    await requireWallet().tryClaimAllLightningReceives({ wait: false })
  },
  log: diagnostics.append,
  maxDelayMs: SYNC_INTERVAL_MS,
  pendingCount: async () => {
    const pending = await requireWallet().pendingLightningReceives()
    return pending.length
  }
})

async function runSync(): Promise<void> {
  if (wallet === null) {
    return
  }
  await wallet.sync()
  await wallet.progressPendingRounds()
  if (onchain !== null) {
    await wallet.progressExits({})
  }
  // start() resets the backoff, so only wake an idle watcher here.
  if (!claimWatcher.isRunning()) {
    claimWatcher.start()
  }
}

function scheduleSync(): void {
  const timer = setTimeout(() => {
    // This timer has fired; only forget it if a newer one has not replaced it.
    if (syncTimer === timer) {
      syncTimer = null
    }
    void (async () => {
      try {
        await runSync()
      } catch (error) {
        // Swallow transient sync errors (the next tick retries), but record
        // them: these are otherwise invisible and are exactly what support
        // needs when a wallet looks stale.
        diagnostics.append('error', `sync failed: ${describeError(error)}`)
      }
      // Re-arm only when no other timer took over meanwhile (e.g. a reopen
      // called startSyncLoop while this sync was still running).
      if (wallet !== null && syncTimer === null) {
        scheduleSync()
      }
    })()
  }, SYNC_INTERVAL_MS)
  syncTimer = timer
}

function startSyncLoop(): void {
  if (syncTimer === null) {
    scheduleSync()
  }
}

const NOTIFICATION_RETRY_DELAY_MS = 3000

async function delay(ms: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, ms)
  })
}

// A rejected nextNotification() must not kill the loop for good: the client's
// subscribed flag stays true, so nothing would ever resubscribe and
// notifications would be silently dead until wallet delete. Free the holder
// and retry with a fresh one instead.
async function drainNotifications(
  holder: NotificationHolder,
  generation: number,
  // oxlint-disable-next-line promise/prefer-await-to-callbacks
  callback: (notification: WalletNotification) => void
): Promise<void> {
  // oxlint-disable-next-line eslint/no-unmodified-loop-condition
  while (generation === notificationGeneration) {
    let notification: WalletNotification | null | undefined
    try {
      notification = await holder.nextNotification()
    } catch (error) {
      diagnostics.append('error', `notification wait failed: ${describeError(error)}`)
      break
    }
    // The bindings' docstring says a cancelled wait resolves to null while
    // the type says undefined — guard both, or teardown would fan out a
    // null notification and crash the client-side mapper.
    if (notification !== undefined && notification !== null) {
      diagnostics.append('info', `notification received (${notification.type})`)
      // oxlint-disable-next-line promise/prefer-await-to-callbacks
      callback(notification)
    }
  }
  holder.free()
  if (notificationHolder !== holder) {
    return
  }
  notificationHolder = null
  // Reaching here with an unchanged generation means the loop broke on an
  // error, not on unsubscribe/teardown (those bump the generation and clear
  // the holder first): resubscribe after a pause.
  if (generation !== notificationGeneration || wallet === null) {
    return
  }
  await delay(NOTIFICATION_RETRY_DELAY_MS)
  if (generation === notificationGeneration && wallet !== null && notificationHolder === null) {
    const nextHolder = requireWallet().notifications()
    notificationHolder = nextHolder
    notificationGeneration += 1
    void drainNotifications(nextHolder, notificationGeneration, callback)
  }
}

async function openWallet(args: OpenArgs): Promise<OpenResult> {
  await ensureWasm()
  // Creating the OnchainWallet persists its IndexedDB before the wallet open
  // validates the mnemonic. If the open then fails on a first-time open, an
  // orphaned onchain DB would make hasStoredWallet() report a wallet that can
  // never be unlocked (createIfNotExists: false finds no ark wallet). Remember
  // whether the DB pre-existed so the failure path can clean it up.
  const hadOnchainDb = await hasDatabase(args.onchainDbName)
  const oc = await OnchainWallet.default({
    config: args.config,
    dbName: args.onchainDbName,
    mnemonic: args.mnemonic,
    network: args.network
  })
  let opened: Wallet
  try {
    // openWithOnchain (not open): `open` consumes the OnchainWallet handle,
    // which would leave `oc` with a null pointer for the direct onchain calls
    // below. openWithOnchain borrows it; both share one underlying bdk wallet.
    opened = await Wallet.openWithOnchain(args.network, args.mnemonic, args.config, oc, {
      createIfNotExists: args.createIfNotExists,
      runDaemon: true
    })
  } catch (error) {
    diagnostics.append(
      'error',
      `open failed (createIfNotExists: ${args.createIfNotExists}): ${describeError(error)}`
    )
    oc.free()
    if (!hadOnchainDb) {
      diagnostics.append('info', 'open cleanup: deleting orphaned onchain store')
      await deleteDatabase(args.onchainDbName)
    }
    throw error
  }
  wallet = opened
  onchain = oc
  sessionMnemonic = args.mnemonic
  diagnostics.append('info', `wallet opened (${opened.fingerprint()})`)
  let scanIncomplete = false
  if (args.restore) {
    try {
      await oc.initialScan()
      diagnostics.append('info', 'initial onchain scan complete')
    } catch (error) {
      scanIncomplete = true
      diagnostics.append('error', `initial onchain scan failed: ${describeError(error)}`)
    }
  }
  startSyncLoop()
  claimWatcher.start()
  return { fingerprint: opened.fingerprint(), scanIncomplete }
}

const api = {
  async adoptServerVtxoStatus(vtxoIds: string[]): Promise<WasmServerVtxoStatus[]> {
    return await requireExpiryPayoutBindings().adoptServerVtxoStatus(vtxoIds)
  },

  async boardAll(): Promise<PendingBoard> {
    return await requireWallet().boardAll()
  },

  async boardAmount(amountSats: number): Promise<PendingBoard> {
    return await requireWallet().boardAmount(amountSats)
  },

  // `drainExits` returns a fully signed PSBT (final witnesses set), so the raw
  // transaction only needs extracting before broadcast. `broadcastTx` expects
  // tx hex, not PSBT base64 — feeding it the PSBT would fail every claim.
  async claimExits(vtxoIds: string[], address: string, feeRateSatPerVb?: number): Promise<string> {
    const w = requireWallet()
    const claim = await w.drainExits({ address, feeRateSatPerVb, vtxoIds })
    return await w.broadcastTx(extractTxFromPsbt(claim.psbtBase64))
  },

  // Handed to the client so it can persist them; workers cannot reach
  // localStorage. Not wallet-gated, for the same reason as getDiagnosticsLog.
  drainDiagnostics(): string[] {
    return diagnostics.drain()
  },

  async estimateBoardFee(amountSats: number): Promise<FeeEstimate> {
    return await requireWallet().estimateBoardFee(amountSats)
  },

  async estimateEmergencyExitFee(
    vtxoIds: string[],
    feeRateSatPerVb?: number,
    destination?: string
  ): Promise<EmergencyExitFeeEstimate> {
    return await requireWallet().estimateEmergencyExitFee(vtxoIds, feeRateSatPerVb, destination)
  },

  async estimateLightningSendFee(amountSats: number): Promise<FeeEstimate> {
    return await requireWallet().estimateLightningSendFee(amountSats)
  },

  async estimateOffboardFee(address: string, vtxoIds: string[]): Promise<FeeEstimate> {
    return await requireWallet().estimateOffboardFee(address, vtxoIds)
  },

  async estimateSendOnchainFee(address: string, amountSats: number): Promise<FeeEstimate> {
    return await requireWallet().estimateSendOnchainFee(address, amountSats)
  },

  async findExpiryPayouts(): Promise<WasmExpiryPayout[]> {
    return await requireExpiryPayoutBindings().findExpiryPayouts()
  },

  async generateInvoice(amountSats: number, description?: string): Promise<LightningInvoice> {
    const invoice = await requireWallet().bolt11Invoice({ amountSats, description })
    claimWatcher.start()
    return invoice
  },

  async getArkInfo(): Promise<ArkInfo> {
    const info = await requireWallet().arkInfo()
    if (info === undefined) {
      throw new Error('Ark info is not available yet')
    }
    return info
  },

  async getBalance(): Promise<Balance> {
    return await requireWallet().balance()
  },

  // Deliberately not wallet-gated: failed opens and wasm-init errors are
  // exactly what this log exists to expose, and they happen while locked.
  getDiagnosticsLog(): string[] {
    return diagnostics.snapshot()
  },

  async getExitStatuses(): Promise<{ vtxo: ExitVtxo; history: ExitState[] | null }[]> {
    const w = requireWallet()
    const vtxos = await w.getExitVtxos()
    const statuses: { vtxo: ExitVtxo; history: ExitState[] | null }[] = []
    for (const vtxo of vtxos) {
      const status = await w.getExitStatus({
        includeHistory: true,
        includeTransactions: false,
        vtxoId: vtxo.vtxoId
      })
      statuses.push({ history: status?.history ?? null, vtxo })
    }
    return statuses
  },

  getFingerprint(): string | null {
    return wallet?.fingerprint() ?? null
  },

  async getHistory(): Promise<Movement[]> {
    return await requireWallet().history()
  },

  getMnemonic(): string | null {
    return sessionMnemonic
  },

  async getOnchainAddress(): Promise<string> {
    return await requireOnchain().newAddress()
  },

  async getOnchainBalance(): Promise<OnchainBalance> {
    return await requireOnchain().balance()
  },

  async getReceiveAddress(): Promise<string> {
    return await requireWallet().newAddress()
  },

  isOpen(): boolean {
    return wallet !== null
  },

  async nextRoundStartTime(): Promise<number> {
    return await requireWallet().nextRoundStartTime()
  },

  async offboardVtxos(vtxoIds: string[], address: string): Promise<OffboardResult> {
    return await requireWallet().offboardVtxos(vtxoIds, address)
  },

  async onchainFeeRates(): Promise<FeeRates> {
    return await requireOnchain().feeRates()
  },

  async onchainSend(address: string, amountSats: number, feeRateSatPerVb: number): Promise<string> {
    return await requireOnchain().send(address, amountSats, feeRateSatPerVb)
  },

  async onchainTransactions(): Promise<WalletTransaction[]> {
    return await requireOnchain().transactions()
  },

  async onchainUtxos(): Promise<OnchainUtxo[]> {
    return await requireOnchain().utxos()
  },

  async open(args: OpenArgs): Promise<OpenResult> {
    if (wallet !== null) {
      // Never silently answer for a different seed: the caller would end up
      // with a session mnemonic that does not control the open wallet's funds.
      if (args.mnemonic !== sessionMnemonic) {
        throw new Error('A different wallet is already open')
      }
      return { fingerprint: wallet.fingerprint(), scanIncomplete: false }
    }
    // Collapse concurrent opens (many hooks call the backend on mount) so the
    // same IndexedDB wallet is never opened twice. The synchronous check-and-set
    // runs before the first await, so no two callers create separate promises.
    // The same-seed guard applies to the in-flight open too.
    if (openPromise !== null && args.mnemonic !== openingMnemonic) {
      throw new Error('A different wallet is already being opened')
    }
    if (openPromise === null) {
      openingMnemonic = args.mnemonic
      openPromise = openWallet(args)
    }
    try {
      return await openPromise
    } finally {
      openPromise = null
      openingMnemonic = null
    }
  },

  // `wait: true` blocks (inside the worker, so the UI stays responsive) until the
  // send reaches a terminal state, so the caller gets a definitive paid result or
  // a thrown error instead of firing and forgetting.
  async payInvoice(invoice: string, amountSats?: number): Promise<LightningSendStatus> {
    return await requireWallet().payLightningInvoice({ amountSats, invoice, wait: true })
  },

  async payLightningAddress(
    lightningAddress: string,
    amountSats: number,
    comment?: string
  ): Promise<LightningSendStatus> {
    return await requireWallet().payLightningAddress({
      amountSats,
      comment,
      lightningAddress,
      wait: true
    })
  },

  async payLnurl(
    lnurl: string,
    amountSats: number,
    comment?: string
  ): Promise<LightningSendStatus> {
    return await requireWallet().payLnurl({ amountSats, comment, lnurl, wait: true })
  },

  async payOffer(offer: string, amountSats?: number): Promise<LightningSendStatus> {
    return await requireWallet().payLightningOffer({ amountSats, offer, wait: true })
  },

  async pendingRoundInputVtxoIds(): Promise<string[]> {
    const w = requireWallet()
    const [vtxos, movements] = await Promise.all([w.pendingRoundInputVtxos(), w.history()])
    return collectPendingRoundInputVtxoIds(
      vtxos.map((vtxo) => vtxo.id),
      movements
    )
  },

  async pendingRoundStates(): Promise<RoundState[]> {
    return await requireWallet().pendingRoundStates()
  },

  // Delegated: the server carries the signed participation through the round,
  // so no long-lived round-event stream has to stay open in the browser. The
  // 20s `progressPendingRounds()` loop finishes it, and the participation is
  // persisted, so it survives a reload.
  async refreshVtxos(vtxoIds: string[]): Promise<RoundState | undefined> {
    return await requireWallet().refreshVtxosDelegated(vtxoIds)
  },

  async sendArkoor(arkAddress: string, amountSats: number): Promise<void> {
    const w = requireWallet()
    const valid = await w.validateArkoorAddress(arkAddress)
    if (!valid) {
      throw new Error('Invalid ark address')
    }
    await w.sendArkoorPayment(arkAddress, amountSats)
  },

  async sendOnchainFromArk(address: string, amountSats: number): Promise<string> {
    return await requireWallet().sendOnchain(address, amountSats)
  },

  async spendableVtxoIds(): Promise<string[]> {
    const vtxos = await requireWallet().spendableVtxos()
    return vtxos.map((vtxo) => vtxo.id)
  },

  async startExitForEntireWallet(feeRateSatPerVb?: number): Promise<void> {
    const w = requireWallet()
    await w.startExitForEntireWallet()
    await w.progressExits({ feeRateSatPerVb })
  },

  async startExitForVtxos(vtxoIds: string[], feeRateSatPerVb?: number): Promise<void> {
    const w = requireWallet()
    await w.startExitForVtxos(vtxoIds)
    await w.progressExits({ feeRateSatPerVb })
  },

  // oxlint-disable-next-line promise/prefer-await-to-callbacks
  subscribeNotifications(callback: (notification: WalletNotification) => void): void {
    if (notificationHolder !== null) {
      return
    }
    const holder = requireWallet().notifications()
    notificationHolder = holder
    notificationGeneration += 1
    void drainNotifications(holder, notificationGeneration, callback)
  },

  async sweepExpiryPayouts(feeRateSatPerVb: number): Promise<WasmExpiryPayoutSweep> {
    return await requireExpiryPayoutBindings().sweepExpiryPayouts(feeRateSatPerVb)
  },

  async tipHeight(): Promise<number> {
    return await requireOnchain().tipHeight()
  },

  unsubscribeNotifications(): void {
    notificationGeneration += 1
    // Unblock a pending nextNotification() so the loop can exit and free the holder.
    notificationHolder?.cancelNextNotificationWait()
    notificationHolder = null
  },

  async vtxoEncoded(vtxoId: string): Promise<string> {
    return await requireWallet().vtxoEncoded(vtxoId)
  },

  async vtxos(all: boolean): Promise<Vtxo[]> {
    const w = requireWallet()
    return all ? await w.allVtxos() : await w.vtxos()
  }
}

export type WasmWorkerApi = typeof api

Comlink.expose(instrumentApi(api, diagnostics))
