import * as Comlink from 'comlink'
import type {
  LightningSendStatus,
  WalletNotification as WasmWalletNotification
} from '@secondts/bark'
import {
  clearStoredOnchainAddresses,
  getStoredOnchainAddresses,
  rememberOnchainAddress
} from '@/lib/backend/wasm/address-store'
import { buildWasmConfig, onchainDbName, toWasmNetwork } from '@/lib/backend/wasm/config'
import { fetchFeeRates, fetchTip, fetchTransactions, fetchUtxos } from '@/lib/backend/wasm/esplora'
import {
  toArkInfo,
  toBalance,
  toExitStatus,
  toFeeEstimate,
  toMovement,
  toNextRoundStart,
  toOffboardTxid,
  toOnchainBalance,
  toPendingBoard,
  toPendingRound,
  toVtxo,
  toWalletNotification
} from '@/lib/backend/wasm/map'
import { clearMovementMetadata, setMovementMetadata } from '@/lib/backend/wasm/metadata-store'
import { classifyDestination, resolveToInvoice } from '@/lib/backend/wasm/send-router'
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

// Silent unlock for passwordless wallets: the device vault holds the mnemonic
// encrypted under a non-extractable IndexedDB key. A password vault always
// wins — its whole point is to gate unlocking behind the password — so its
// presence disables the silent path even if a stale device vault remains.
export async function tryDeviceUnlock(): Promise<boolean> {
  if (hasVault()) {
    return false
  }
  const mnemonic = await openDeviceVault()
  if (mnemonic === null) {
    return false
  }
  try {
    await unlockWallet(mnemonic)
    return true
  } catch {
    return false
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

async function newOnchainAddress(): Promise<string> {
  const address = await remote().getOnchainAddress()
  rememberOnchainAddress(address)
  return address
}

// Union of the worker's in-memory addresses and the persisted ones, so onchain
// history survives a reload (the worker set is empty in a fresh session).
async function knownOnchainAddresses(): Promise<string[]> {
  const fromWorker = await remote().getOnchainAddresses()
  return [...new Set([...fromWorker, ...getStoredOnchainAddresses()])]
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
  const invoice =
    kind === 'bolt11' ? destination : await resolveToInvoice(destination, kind, amountSats, comment)
  const status = await remote().payInvoice(invoice, amountSats ?? undefined)
  return { message: lightningSendMessage(status) }
}

export const wasmBackend: Backend = {
  bitcoinApi: {
    tip: async () => await fetchTip()
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
      const [exitVtxos, tip] = await Promise.all([remote().getExitVtxos(), fetchTip()])
      return exitVtxos.map((exitVtxo) => toExitStatus(exitVtxo, tip))
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
    onchainFeeRates: async () => await fetchFeeRates(),
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
      return await newOnchainAddress()
    },
    onchainBalance: async () => {
      await ensureOpen()
      return toOnchainBalance(await remote().getOnchainBalance())
    },
    onchainSend: async ({ destination, amountSats }) => {
      await ensureOpen()
      const feeRates = await fetchFeeRates()
      const txid = await remote().onchainSend(destination, amountSats, feeRates.regularSatPerVb)
      return { txid }
    },
    onchainTransactions: async () => {
      await ensureOpen()
      return await fetchTransactions(await knownOnchainAddresses())
    },
    onchainUtxos: async () => {
      await ensureOpen()
      return await fetchUtxos(await knownOnchainAddresses())
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
      const target = address ?? (await newOnchainAddress())
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
        clearStoredOnchainAddresses(fingerprint)
        clearMovementMetadata(fingerprint)
      }
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
