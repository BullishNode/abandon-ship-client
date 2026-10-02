import * as Comlink from 'comlink'
import type {
  LightningSendStatus,
  WalletNotification as WasmWalletNotification
} from '@secondts/bark'
import { buildWasmConfig, onchainDbName, toWasmNetwork } from '@/lib/backend/wasm/config'
import {
  toArkInfo,
  toBalance,
  toEmergencyExitFeeEstimate,
  toExitStatus,
  toFeeEstimate,
  toMovement,
  toNextRoundStart,
  toOnchainBalance,
  toOnchainFeeRates,
  toPendingBoard,
  toPendingRound,
  toUtxos,
  toVtxo,
  toWalletNotification,
  toWalletTx
} from '@/lib/backend/wasm/map'
import {
  appendMissingDiagnostics,
  appendPersistedDiagnostics,
  clearPersistedDiagnostics,
  readPersistedDiagnostics
} from '@/lib/backend/wasm/diagnostics-store'
import { clearMovementMetadata, setMovementMetadata } from '@/lib/backend/wasm/metadata-store'
import { classifyDestination } from '@/lib/backend/wasm/send-router'
import type { RefreshPhase } from '@/types/domain/round'
import { isRoundActive, roundRefreshPhase } from '@/utils/refresh'
import type { SendKind } from '@/lib/backend/wasm/send-router'
import {
  clearSessionMnemonic,
  getSessionMnemonic,
  hasSessionMnemonic,
  setSessionMnemonic
} from '@/lib/backend/wasm/seed'
import { clearDeviceVault, openDeviceVault, saveDeviceVault } from '@/lib/backend/wasm/device-vault'
import { clearVault, hasVault } from '@/lib/backend/wasm/vault'
import {
  canEnumerateDatabases,
  deleteDatabase,
  hasDatabase,
  walletDatabaseNames
} from '@/lib/backend/wasm/idb'
import {
  clearWalletMarker,
  hasWalletMarker,
  setWalletMarker
} from '@/lib/backend/wasm/wallet-marker'
import type { WasmWorkerApi } from '@/lib/backend/wasm/worker'
import { config } from '@/config/runtime'
import { useWalletStore } from '@/stores/wallet'
import type { Backend } from '@/types/backend'
import type { WalletNotification } from '@/types/domain/notification'
import type { CreateWalletResult, SendResult } from '@/types/domain/wallet'
import { toServerVtxoState } from '@/utils/expiry-payout'

// Thrown when a wallet exists in IndexedDB but the session seed is not in memory
// (e.g. after a page reload). The auth gate catches this to prompt for the seed.
export class WalletLockedError extends Error {
  constructor() {
    super('Wallet is locked')
    this.name = 'WalletLockedError'
  }
}

// The worker is created lazily so this module has no top-level side effects and
// is fully dropped by dead-code elimination in barkd builds.
let remoteRef: Comlink.Remote<WasmWorkerApi> | null = null
let workerRef: Worker | null = null

// Diagnostics flush. The worker's log is memory-only, so it dies on reload and
// on the terminateWorker() that every wallet delete performs. Draining it into
// localStorage on a timer keeps the history support actually needs.
const DIAGNOSTICS_FLUSH_INTERVAL_MS = 5000
let diagnosticsFlushTimer: ReturnType<typeof setInterval> | null = null

// Never throws: a diagnostics failure must not surface as a wallet error. A dead
// or terminated worker simply has nothing to drain.
async function flushDiagnostics(): Promise<void> {
  if (remoteRef === null) {
    return
  }
  try {
    const drained = await remoteRef.drainDiagnostics()
    appendPersistedDiagnostics(drained)
  } catch {
    // Worker terminated or unreachable; the entries are gone either way.
  }
}

// Flushing on hide (not on 'unload', which modern browsers may skip) is the last
// chance to persist before a tab close or navigation.
function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    void flushDiagnostics()
  }
}

function startDiagnosticsFlush(): void {
  if (diagnosticsFlushTimer !== null) {
    return
  }
  diagnosticsFlushTimer = setInterval(() => {
    void flushDiagnostics()
  }, DIAGNOSTICS_FLUSH_INTERVAL_MS)
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

function stopDiagnosticsFlush(): void {
  if (diagnosticsFlushTimer !== null) {
    clearInterval(diagnosticsFlushTimer)
    diagnosticsFlushTimer = null
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

function remote(): Comlink.Remote<WasmWorkerApi> {
  if (remoteRef === null) {
    const worker = new Worker(new URL('worker.ts', import.meta.url), { type: 'module' })
    workerRef = worker
    remoteRef = Comlink.wrap<WasmWorkerApi>(worker)
    startDiagnosticsFlush()
  }
  return remoteRef
}

async function openWithSeed(
  mnemonic: string,
  createIfNotExists: boolean,
  restore = false
): Promise<{ fingerprint: string; scanIncomplete: boolean }> {
  const result = await remote().open({
    config: buildWasmConfig(),
    createIfNotExists,
    mnemonic,
    network: toWasmNetwork(config.network),
    onchainDbName: onchainDbName(),
    restore
  })
  setWalletMarker()
  return result
}

// Wallet persistence check. IndexedDB enumeration is authoritative; the
// localStorage marker only stands in where the enumeration API is missing. The
// stores are origin-scoped, so this realm can answer without booting a worker.
async function hasPersistedWallet(): Promise<boolean> {
  if (canEnumerateDatabases()) {
    return await hasDatabase(onchainDbName())
  }
  return hasWalletMarker()
}

// The in-flight wallet delete, so a racing query cannot spin up a fresh worker
// and reopen (recreating) the very stores being deleted, and a racing create
// waits for the teardown instead of opening a new wallet on the same
// (network-derived) onchain store name while it is being dropped.
let deletion: Promise<unknown> | null = null

// The in-flight wallet create. An import's open runs the seed-recovery and
// onchain scans for minutes, with the onchain store already persisted but the
// seed not yet in session, so walletExists() would read it as a locked wallet.
let creation: Promise<unknown> | null = null

async function openNewWallet(mnemonic: string, restore: boolean): Promise<CreateWalletResult> {
  const pending = openWithSeed(mnemonic, true, restore)
  creation = pending
  try {
    return await pending
  } finally {
    if (creation === pending) {
      creation = null
    }
  }
}

// Ensure the worker has an open wallet before a read/write. On reload the worker
// is empty; if the session seed is present we reopen, otherwise the wallet is
// locked and the caller must collect the seed.
async function ensureOpen(): Promise<void> {
  if (deletion !== null) {
    throw new Error('Wallet is being deleted')
  }
  if (await remote().isOpen()) {
    return
  }
  const seed = getSessionMnemonic()
  if (seed === null) {
    throw new WalletLockedError()
  }
  await openWithSeed(seed, false)
}

// The export merges what is stored with the live worker buffer: the worker holds
// entries appended since the last flush, and (after a reload) storage holds the
// history the worker never saw.
export async function getDiagnosticsLog(): Promise<string[]> {
  await flushDiagnostics()
  const persisted = readPersistedDiagnostics()
  if (remoteRef === null) {
    return persisted
  }
  try {
    return appendMissingDiagnostics(persisted, await remoteRef.getDiagnosticsLog())
  } catch {
    return persisted
  }
}

// A wallet is "locked" when its data is persisted in IndexedDB but the session
// seed is not in memory (after a reload). The auth gate uses this to decide
// whether to prompt for the seed.
export async function isWalletLocked(): Promise<boolean> {
  if (hasSessionMnemonic()) {
    return false
  }
  return await hasPersistedWallet()
}

let unlocking: Promise<unknown> | null = null

// Reopen an existing wallet with a re-supplied seed. `createIfNotExists: false`
// means a wrong seed (whose fingerprint has no stored wallet) rejects instead of
// silently creating a fresh wallet. The session seed is only stored once the
// open succeeds, so it can never disagree with the wallet that is actually open.
export async function unlockWallet(mnemonic: string): Promise<void> {
  if (deletion !== null) {
    throw new Error('Wallet is being deleted')
  }
  const pending = openWithSeed(mnemonic, false)
  unlocking = pending
  try {
    await pending
  } finally {
    if (unlocking === pending) {
      unlocking = null
    }
  }
  setSessionMnemonic(mnemonic)
}

export type DeviceUnlockResult =
  // The silent path succeeded; the session is unlocked.
  | { status: 'unlocked' }
  // No usable device vault (password set, vault missing/corrupt): the gate
  // must collect the password or the seed phrase.
  | { status: 'no-vault' }
  // The vault decrypted fine but reopening the wallet failed. The seed is
  // provably present, so this is environmental (chain source unreachable,
  // wasm fetch failed) — retryable, and the device vault stays armed.
  | { status: 'failed'; error: Error }

// Silent unlock for passwordless wallets: the device vault holds the mnemonic
// encrypted under a non-extractable IndexedDB key. A password vault always
// wins — its whole point is to gate unlocking behind the password — so its
// presence disables the silent path even if a stale device vault remains.
export async function tryDeviceUnlock(): Promise<DeviceUnlockResult> {
  if (hasVault()) {
    return { status: 'no-vault' }
  }
  const mnemonic = await openDeviceVault()
  if (mnemonic === null) {
    return { status: 'no-vault' }
  }
  try {
    await unlockWallet(mnemonic)
    return { status: 'unlocked' }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
      status: 'failed'
    }
  }
}

// Eviction protection for the wallet's IndexedDB/localStorage state. Browsers
// may deny or ignore this; the wallet still works, it is just evictable.
async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage.persist()
  } catch {
    // Best-effort only.
  }
}

// The worker exposes a single notification callback, so the client owns the
// fan-out: one worker subscription drives every listener. Mirrors the barkd
// backend's listener set (src/lib/backend/barkd/notifications.ts) so the
// dashboard's concurrent subscribers (movement sync + refresh-on-receive) all
// receive notifications.
const notificationListeners = new Set<(notification: WalletNotification) => void>()

// Worker subscribe/unsubscribe are queued so they reach the worker strictly in
// order: without this, a fast unmount/remount could deliver the unsubscribe
// before the (async, ensureOpen-gated) subscribe, stranding a running worker
// loop with no listeners. Each queued op re-checks the live listener count, so
// an op made stale by later subscribes/unsubscribes becomes a no-op.
let workerQueue: Promise<unknown> = Promise.resolve()
let workerSubscribed = false

function enqueueWorkerOp(op: () => Promise<void>): void {
  const previous = workerQueue
  workerQueue = (async () => {
    await previous
    try {
      await op()
    } catch {
      // A failed op (e.g. wallet still locked) leaves workerSubscribed false,
      // so the next subscribe retries; the queue itself never stays rejected.
    }
  })()
}

// Killing the worker is the only reliable way to release the IndexedDB
// connections the WASM wallet holds: freeing the handles does not close them,
// so `deleteDatabase` stays blocked forever and the delete never completes.
// Terminating also cannot be held up by an in-flight sync (a graceful close
// awaits it, which hangs for as long as the network does). The next `remote()`
// call spins up a fresh worker, which starts with no subscription.
function terminateWorker(): void {
  stopDiagnosticsFlush()
  workerRef?.terminate()
  workerRef = null
  remoteRef = null
  workerSubscribed = false
  // A queued op awaiting the terminated worker never settles (its reply message
  // can no longer arrive), so drop the chain: otherwise every later
  // subscribe/unsubscribe would wait behind it forever.
  workerQueue = Promise.resolve()
}

function fanOutNotification(notification: WasmWalletNotification): void {
  const domain = toWalletNotification(notification)
  for (const listener of notificationListeners) {
    listener(domain)
  }
}

function subscribeNotifications(listener: (notification: WalletNotification) => void): () => void {
  notificationListeners.add(listener)
  enqueueWorkerOp(async () => {
    if (workerSubscribed || notificationListeners.size === 0) {
      return
    }
    await ensureOpen()
    await remote().subscribeNotifications(Comlink.proxy(fanOutNotification))
    workerSubscribed = true
  })
  return () => {
    notificationListeners.delete(listener)
    enqueueWorkerOp(async () => {
      if (!workerSubscribed || notificationListeners.size > 0) {
        return
      }
      await remote().unsubscribeNotifications()
      workerSubscribed = false
    })
  }
}

function lightningSendMessage(status: LightningSendStatus): string {
  return status.type === 'paid' ? 'Lightning payment sent' : 'Lightning payment in progress'
}

async function routeSend(
  destination: string,
  kind: SendKind,
  amountSats: number | null | undefined,
  comment: string | null | undefined
): Promise<SendResult> {
  if (kind === 'ark') {
    if (amountSats === null || amountSats === undefined) {
      throw new Error('An amount is required for ark payments')
    }
    await remote().sendArkoor(destination, amountSats)
    return { message: 'Ark payment sent' }
  }
  if (kind === 'bolt12') {
    const status = await remote().payOffer(destination, amountSats ?? undefined)
    return { message: lightningSendMessage(status) }
  }
  if (kind === 'lightning-address' || kind === 'lnurl') {
    if (amountSats === null || amountSats === undefined) {
      throw new Error('An amount is required to pay a lightning address')
    }
    // The bindings resolve LNURL-pay themselves (browser fetch, so the endpoint
    // must allow CORS). Forward only a non-empty comment: the bindings do no
    // LUD-12 commentAllowed gating, and an unexpected param can be rejected.
    const trimmedComment = comment?.trim()
    const lnurlComment =
      trimmedComment !== undefined && trimmedComment.length > 0 ? trimmedComment : undefined
    const status =
      kind === 'lightning-address'
        ? await remote().payLightningAddress(destination.trim(), amountSats, lnurlComment)
        : await remote().payLnurl(destination.trim(), amountSats, lnurlComment)
    return { message: lightningSendMessage(status) }
  }
  const status = await remote().payInvoice(destination, amountSats ?? undefined)
  return { message: lightningSendMessage(status) }
}

// Every unlock path is cleared before the stores: once they are gone, a
// lingering seed would make the next walletExists() try to reopen the deleted
// wallet and fail instead of reporting "no wallet" (which routes the app to the
// create flow).
async function deleteWalletStorage(fingerprint: string | null): Promise<void> {
  clearSessionMnemonic()
  clearWalletMarker()
  clearVault()
  await clearDeviceVault()
  if (fingerprint !== null && fingerprint.length > 0) {
    clearMovementMetadata(fingerprint)
  }
  // Stale key from the pre-0.16 address side-store, superseded by the bindings'
  // own transaction/utxo listing.
  localStorage.removeItem('bark-web-wasm-onchain-addresses')
  // Enumerate before terminating: the names are read from this realm, but the
  // stores can only be dropped once the worker's connections are gone.
  const names = await walletDatabaseNames(onchainDbName(), fingerprint)
  terminateWorker()
  // The deleted wallet's activity must not outlive it. Cleared after the worker
  // is gone (nothing can append) and before the drop, which may throw.
  clearPersistedDiagnostics()
  const deleted = await Promise.all(names.map(deleteDatabase))
  if (deleted.includes(false)) {
    throw new Error(
      'Wallet storage could not be fully deleted. Close other tabs using this wallet and try again.'
    )
  }
}

export async function eraseLockedWallet(): Promise<void> {
  if (unlocking !== null) {
    try {
      await unlocking
    } catch {
      // A failed unlock changes nothing about the erase.
    }
  }
  const fingerprint = useWalletStore.getState().wallet?.fingerprint ?? null
  const pending = deleteWalletStorage(fingerprint)
  deletion = pending
  try {
    await pending
  } finally {
    deletion = null
  }
}

export const wasmBackend: Backend = {
  bitcoinApi: {
    tip: async () => {
      await ensureOpen()
      return await remote().tipHeight()
    }
  },
  boardsApi: {
    boardAll: async () => {
      await ensureOpen()
      return toPendingBoard(await remote().boardAll())
    },
    boardAmount: async ({ amountSats }) => {
      await ensureOpen()
      return toPendingBoard(await remote().boardAmount(amountSats))
    }
  },
  exitsApi: {
    emergencyExitFee: async ({ vtxos, feeRateSatPerVb, destination }) => {
      await ensureOpen()
      return toEmergencyExitFeeEstimate(
        await remote().estimateEmergencyExitFee(vtxos, feeRateSatPerVb, destination)
      )
    },
    exitClaimVtxos: async ({ destination, vtxos, feeRate }) => {
      await ensureOpen()
      const txid = await remote().claimExits(vtxos, destination, feeRate ?? undefined)
      return { message: txid }
    },
    exitStartAll: async () => {
      await ensureOpen()
      await remote().startExitForEntireWallet()
      return { message: 'Emergency exit started' }
    },
    exitStartVtxos: async ({ vtxos }) => {
      await ensureOpen()
      await remote().startExitForVtxos(vtxos)
      return { message: 'Emergency exit started' }
    },
    getAllExitStatus: async () => {
      await ensureOpen()
      const statuses = await remote().getExitStatuses()
      return statuses.map(({ vtxo, history }) => toExitStatus(vtxo, history))
    }
  },
  feesApi: {
    boardFee: async ({ amountSats }) => {
      await ensureOpen()
      return toFeeEstimate(await remote().estimateBoardFee(amountSats))
    },
    lightningSendFee: async ({ amountSats }) => {
      await ensureOpen()
      return toFeeEstimate(await remote().estimateLightningSendFee(amountSats))
    },
    offboardFee: async ({ address, vtxos }) => {
      await ensureOpen()
      return toFeeEstimate(await remote().estimateOffboardFee(address, vtxos))
    },
    onchainFeeRates: async () => {
      await ensureOpen()
      return toOnchainFeeRates(await remote().onchainFeeRates())
    },
    sendOnchainFee: async ({ address, amountSats }) => {
      await ensureOpen()
      return toFeeEstimate(await remote().estimateSendOnchainFee(address, amountSats))
    }
  },
  historyApi: {
    list: async () => {
      await ensureOpen()
      const movements = await remote().getHistory()
      return movements.map(toMovement)
    },
    // oxlint-disable-next-line require-await
    updateMetadata: async ({ id, metadata }) => {
      setMovementMetadata(id, metadata)
    }
  },
  lightningApi: {
    generateInvoice: async ({ amountSats, description }) => {
      await ensureOpen()
      const invoice = await remote().generateInvoice(amountSats, description ?? undefined)
      return { invoice: invoice.invoice }
    }
  },
  notifications: {
    subscribe: subscribeNotifications
  },
  onchainApi: {
    onchainAddress: async () => {
      await ensureOpen()
      return await remote().getOnchainAddress()
    },
    onchainBalance: async () => {
      await ensureOpen()
      return toOnchainBalance(await remote().getOnchainBalance())
    },
    onchainSend: async ({ destination, amountSats }) => {
      await ensureOpen()
      const feeRates = toOnchainFeeRates(await remote().onchainFeeRates())
      const txid = await remote().onchainSend(destination, amountSats, feeRates.regularSatPerVb)
      return { txid }
    },
    onchainTransactions: async () => {
      await ensureOpen()
      const transactions = await remote().onchainTransactions()
      return transactions.map(toWalletTx)
    },
    onchainUtxos: async () => {
      await ensureOpen()
      return toUtxos(await remote().onchainUtxos())
    },
    sweepExpiryPayouts: async (params) => {
      await ensureOpen()
      const feeRate =
        params?.feeRateSatPerVb ??
        toOnchainFeeRates(await remote().onchainFeeRates()).regularSatPerVb
      return await remote().sweepExpiryPayouts(feeRate)
    }
  },
  walletApi: {
    address: async () => {
      await ensureOpen()
      return await remote().getReceiveAddress()
    },
    adoptServerVtxoStatus: async (params) => {
      await ensureOpen()
      const statuses = await remote().adoptServerVtxoStatus(params?.vtxos)
      return statuses.map(({ vtxoId, state }) => ({ state: toServerVtxoState(state), vtxoId }))
    },
    arkInfo: async () => {
      await ensureOpen()
      return toArkInfo(await remote().getArkInfo())
    },
    balance: async () => {
      await ensureOpen()
      return toBalance(await remote().getBalance())
    },
    createWallet: async ({ mnemonic, restore }) => {
      // A delete in flight is dropping stores this create would immediately
      // recreate under the same onchain name — and would then have deleted out
      // from under it. Wait it out instead of racing it.
      if (deletion !== null) {
        try {
          await deletion
        } catch {
          // A delete that could not drop every store still ended its teardown;
          // creating on top of the leftovers is better than refusing to create.
        }
      }
      const { fingerprint, scanIncomplete } = await openNewWallet(mnemonic, restore ?? false)
      setSessionMnemonic(mnemonic)
      // Vaults surviving from a previous wallet (e.g. IndexedDB cleared but
      // localStorage kept) hold the OLD mnemonic: the next reload would demand
      // a password that can only ever fail, or silently open the wrong seed.
      clearVault()
      await clearDeviceVault()
      // Passwordless wallets auto-unlock on reload via the device vault.
      try {
        await saveDeviceVault(mnemonic)
      } catch {
        // Non-fatal: the user came through create/import holding their words,
        // so reloads fall back to the interactive mnemonic gate.
      }
      void requestPersistentStorage()
      return { fingerprint, scanIncomplete }
    },
    findExpiryPayouts: async (params) => {
      await ensureOpen()
      return await remote().findExpiryPayouts(params?.vtxos)
    },
    mnemonic: async () => {
      const seed = getSessionMnemonic() ?? (await remote().getMnemonic())
      if (seed === null) {
        throw new WalletLockedError()
      }
      return seed
    },
    nextRound: async () => {
      await ensureOpen()
      return toNextRoundStart(await remote().nextRoundStartTime())
    },
    offboardVtxos: async ({ vtxos, address }) => {
      await ensureOpen()
      const target = address ?? (await remote().getOnchainAddress())
      const result = await remote().offboardVtxos(vtxos, target)
      return { offboardTxid: result.txid }
    },
    pendingRounds: async () => {
      await ensureOpen()
      const rounds = await remote().pendingRoundStates()
      return rounds.map(toPendingRound)
    },
    refreshAll: async () => {
      await ensureOpen()
      // barkd's `refreshAll` registers every spendable VTXO, and that is what
      // the fee estimate in the actions menu prices. bark's own
      // `getVtxosToRefresh()` is a near-expiry subset, so using it here made
      // refresh-all a silent no-op whenever nothing was close to expiring.
      // A queued round's inputs still read as spendable, so drop them here.
      const [spendableIds, inRoundIds] = await Promise.all([
        remote().spendableVtxoIds(),
        remote().pendingRoundInputVtxoIds()
      ])
      const inRound = new Set(inRoundIds)
      const vtxoIds = spendableIds.filter((id) => !inRound.has(id))
      if (vtxoIds.length === 0) {
        return null
      }
      const round = await remote().refreshVtxos(vtxoIds)
      return round === undefined ? null : toPendingRound(round)
    },
    refreshVtxos: async ({ vtxos }) => {
      await ensureOpen()
      const round = await remote().refreshVtxos(vtxos)
      return round === undefined ? null : toPendingRound(round)
    },
    refreshingVtxos: async () => {
      await ensureOpen()
      // bark cannot attribute an input to a specific round, so every pending
      // input shares one phase.
      const [ids, rounds] = await Promise.all([
        remote().pendingRoundInputVtxoIds(),
        remote().pendingRoundStates()
      ])
      // A failed or canceled round is over and must not push the phase to
      // `refreshing`, the same guard `refreshingVtxosFromRounds` applies for
      // barkd. bark drops those rows within a sync, so this is a narrow window.
      const isAnyRefreshing = rounds
        .map(toPendingRound)
        .some((round) => isRoundActive(round) && roundRefreshPhase(round) === 'refreshing')
      const phase: RefreshPhase = isAnyRefreshing ? 'refreshing' : 'queued'
      return ids.map((id) => ({ id, phase }))
    },
    send: async ({ destination, amountSats, comment }) => {
      await ensureOpen()
      const kind = classifyDestination(destination)
      return await routeSend(destination, kind, amountSats, comment)
    },
    sendOnchain: async ({ destination, amountSats }) => {
      await ensureOpen()
      const txid = await remote().sendOnchainFromArk(destination, amountSats)
      return { offboardTxid: txid }
    },
    vtxoEncoded: async (id) => {
      await ensureOpen()
      return await remote().vtxoEncoded(id)
    },
    vtxos: async (params) => {
      await ensureOpen()
      const vtxos = await remote().vtxos(params?.all ?? false)
      return vtxos.map(toVtxo)
    },
    walletDelete: async ({ fingerprint }) => {
      const pending = deleteWalletStorage(fingerprint)
      deletion = pending
      try {
        await pending
        return { deleted: true, message: 'Wallet deleted' }
      } finally {
        deletion = null
      }
    },
    walletExists: async () => {
      // Like barkd, which only reports a wallet once its create has returned.
      if (deletion !== null || creation !== null) {
        return { fingerprint: undefined }
      }
      if (await remote().isOpen()) {
        return { fingerprint: (await remote().getFingerprint()) ?? undefined }
      }
      const seed = getSessionMnemonic()
      if (seed !== null) {
        const { fingerprint } = await openWithSeed(seed, false)
        return { fingerprint }
      }
      // Re-checked: a create that began during the awaits above may own the store.
      if ((await hasPersistedWallet()) && creation === null) {
        throw new WalletLockedError()
      }
      return { fingerprint: undefined }
    }
  }
}
