import * as Comlink from 'comlink'
import type {
  LightningSendStatus,
  WalletNotification as WasmWalletNotification
} from '@secondts/bark'
import { buildWasmConfig, onchainDbName, toWasmNetwork } from '@/lib/backend/wasm/config'
import {
  toArkInfo,
  toBalance,
  toExitStatus,
  toFeeEstimate,
  toMovement,
  toNextRoundStart,
  toOffboardTxid,
  toOnchainBalance,
  toOnchainFeeRates,
  toPendingBoard,
  toPendingRound,
  toUtxos,
  toVtxo,
  toWalletNotification,
  toWalletTx
} from '@/lib/backend/wasm/map'
import { clearMovementMetadata, setMovementMetadata } from '@/lib/backend/wasm/metadata-store'
import { classifyDestination } from '@/lib/backend/wasm/send-router'
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
  clearWalletMarker,
  hasWalletMarker,
  setWalletMarker
} from '@/lib/backend/wasm/wallet-marker'
import type { WasmWorkerApi } from '@/lib/backend/wasm/worker'
import { config } from '@/config/runtime'
import type { Backend } from '@/types/backend'
import type { WalletNotification } from '@/types/domain/notification'
import type { SendResult } from '@/types/domain/wallet'

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

function remote(): Comlink.Remote<WasmWorkerApi> {
  if (remoteRef === null) {
    const worker = new Worker(new URL('worker.ts', import.meta.url), { type: 'module' })
    remoteRef = Comlink.wrap<WasmWorkerApi>(worker)
  }
  return remoteRef
}

async function openWithSeed(mnemonic: string, createIfNotExists: boolean): Promise<string> {
  const fingerprint = await remote().open({
    config: buildWasmConfig(),
    createIfNotExists,
    mnemonic,
    network: toWasmNetwork(config.network),
    onchainDbName: onchainDbName()
  })
  setWalletMarker()
  return fingerprint
}

// Wallet persistence check. IndexedDB enumeration is authoritative; the
// localStorage marker only stands in where the enumeration API is missing.
async function hasPersistedWallet(): Promise<boolean> {
  if (canEnumerateDatabases()) {
    return await remote().hasStoredWallet([onchainDbName()])
  }
  return hasWalletMarker()
}

// Ensure the worker has an open wallet before a read/write. On reload the worker
// is empty; if the session seed is present we reopen, otherwise the wallet is
// locked and the caller must collect the seed.
async function ensureOpen(): Promise<void> {
  if (await remote().isOpen()) {
    return
  }
  const seed = getSessionMnemonic()
  if (seed === null) {
    throw new WalletLockedError()
  }
  await openWithSeed(seed, false)
}

export async function getDiagnosticsLog(): Promise<string[]> {
  return await remote().getDiagnosticsLog()
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

// Reopen an existing wallet with a re-supplied seed. `createIfNotExists: false`
// means a wrong seed (whose fingerprint has no stored wallet) rejects instead of
// silently creating a fresh wallet. The session seed is only stored once the
// open succeeds, so it can never disagree with the wallet that is actually open.
export async function unlockWallet(mnemonic: string): Promise<void> {
  await openWithSeed(mnemonic, false)
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
    }
  },
  walletApi: {
    address: async () => {
      await ensureOpen()
      return await remote().getReceiveAddress()
    },
    arkInfo: async () => {
      await ensureOpen()
      return toArkInfo(await remote().getArkInfo())
    },
    balance: async () => {
      await ensureOpen()
      return toBalance(await remote().getBalance())
    },
    createWallet: async ({ mnemonic }) => {
      const fingerprint = await openWithSeed(mnemonic, true)
      setSessionMnemonic(mnemonic)
      // Vaults surviving from a previous wallet (e.g. IndexedDB cleared but
      // localStorage kept) hold the OLD mnemonic: the next reload would demand
      // a password that can only ever fail, or silently open the wrong seed.
      clearVault()
      await clearDeviceVault()
      // Passwordless wallets auto-unlock on reload via the device vault.
      // Failure is non-fatal here: explicit-create/import users hold their
      // words and fall back to the mnemonic gate, and the auto-create flow
      // verifies the vault readback itself before treating the wallet as safe.
      try {
        await saveDeviceVault(mnemonic)
      } catch {
        // Reloads fall back to the interactive mnemonic gate.
      }
      void requestPersistentStorage()
      return { fingerprint }
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
      const roundStatus = await remote().offboardVtxos(vtxos, target)
      return { offboardTxid: toOffboardTxid(roundStatus) }
    },
    pendingRounds: async () => {
      await ensureOpen()
      const rounds = await remote().pendingRoundStates()
      return rounds.map(toPendingRound)
    },
    refreshAll: async () => {
      await ensureOpen()
      const vtxoIds = await remote().refreshableVtxoIds()
      await remote().refreshVtxos(vtxoIds)
      return { id: 0, ongoing: true }
    },
    refreshVtxos: async ({ vtxos }) => {
      await ensureOpen()
      await remote().refreshVtxos(vtxos)
      return { id: 0, ongoing: true }
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
      await remote().deleteWallet(onchainDbName(), fingerprint)
      // Drop the session seed too, or the next walletExists() would try to
      // reopen the just-deleted wallet with it and fail instead of reporting
      // "no wallet" (which routes the app to the create flow).
      clearSessionMnemonic()
      clearWalletMarker()
      clearVault()
      await clearDeviceVault()
      if (fingerprint !== null && fingerprint.length > 0) {
        clearMovementMetadata(fingerprint)
      }
      // Stale key from the pre-0.16 address side-store, superseded by the
      // bindings' own transaction/utxo listing.
      localStorage.removeItem('bark-web-wasm-onchain-addresses')
      // The worker's teardown killed its notification loop; resync the client
      // flag through the queue so the next wallet re-subscribes instead of
      // no-opping on a stale `true`.
      // oxlint-disable-next-line require-await
      enqueueWorkerOp(async () => {
        workerSubscribed = false
      })
      return { deleted: true, message: 'Wallet deleted' }
    },
    walletExists: async () => {
      if (await remote().isOpen()) {
        return { fingerprint: (await remote().getFingerprint()) ?? undefined }
      }
      const seed = getSessionMnemonic()
      if (seed !== null) {
        return { fingerprint: await openWithSeed(seed, false) }
      }
      if (await hasPersistedWallet()) {
        throw new WalletLockedError()
      }
      return { fingerprint: undefined }
    }
  }
}
