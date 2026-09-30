import type { wrap } from 'comlink'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const workerRemote = vi.hoisted(() => ({
  getFingerprint: vi.fn<() => Promise<string | null>>(),
  isOpen: vi.fn<() => Promise<boolean>>(),
  open: vi.fn<() => Promise<{ fingerprint: string; scanIncomplete: boolean }>>()
}))

// The existence check under test lives entirely on the client side, so `wrap`
// hands back a plain mock. The cast is unavoidable: a mock remote cannot
// satisfy the Remote<T> proxy type `wrap` promises.
vi.mock(import('comlink'), async (importOriginal) => ({
  ...(await importOriginal()),
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  wrap: (() => workerRemote) as unknown as typeof wrap
}))

// Enumerable, as in current browsers: that is where the onchain store an import
// persists before its open resolves reads as a stored wallet.
vi.mock(import('@/lib/backend/wasm/idb'), () => ({
  canEnumerateDatabases: vi.fn<() => boolean>(() => true),
  deleteDatabase: vi.fn<(name: string) => Promise<boolean>>(),
  hasDatabase: vi.fn<(name: string) => Promise<boolean>>(),
  walletDatabaseNames: vi.fn<() => Promise<string[]>>()
}))

vi.mock(import('@/lib/backend/wasm/device-vault'), () => ({
  clearDeviceVault: vi.fn<() => Promise<void>>(),
  hasDeviceVault: vi.fn<() => boolean>(() => false),
  isDeviceVaultSupported: vi.fn<() => Promise<boolean>>(),
  openDeviceVault: vi.fn<() => Promise<string | null>>(),
  saveDeviceVault: vi.fn<(mnemonic: string) => Promise<void>>()
}))

class WorkerStub {
  terminate = vi.fn<() => void>()
}

vi.stubGlobal('Worker', WorkerStub)

const { hasDatabase } = await import('@/lib/backend/wasm/idb')
const { clearSessionMnemonic } = await import('@/lib/backend/wasm/seed')
const { WalletLockedError, wasmBackend } = await import('@/lib/backend/wasm/client')

const hasDatabaseMock = vi.mocked(hasDatabase)
const { createWallet, walletExists } = wasmBackend.walletApi

const SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const OPENED = { fingerprint: 'f00dbabe', scanIncomplete: false }

// Holds the worker's open in flight until the test settles it, as an import's
// seed-recovery and onchain scans do for minutes.
function holdOpen() {
  let resolveOpen: ((result: typeof OPENED) => void) | undefined
  let rejectOpen: ((reason: Error) => void) | undefined
  workerRemote.open.mockImplementation(
    async () =>
      // oxlint-disable-next-line promise/avoid-new
      await new Promise((resolve, reject) => {
        resolveOpen = resolve
        rejectOpen = reject
      })
  )
  return {
    reject: (reason: Error) => rejectOpen?.(reason),
    resolve: () => resolveOpen?.(OPENED)
  }
}

describe('walletExists around a wallet create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearSessionMnemonic()
    workerRemote.isOpen.mockResolvedValue(false)
    // Creating the OnchainWallet persists its store before the open resolves.
    hasDatabaseMock.mockResolvedValue(true)
  })

  it('reports no wallet instead of a locked one while the recovery scan holds the open', async () => {
    const open = holdOpen()
    const create = createWallet({ mnemonic: SEED, restore: true })

    await expect(walletExists()).resolves.toStrictEqual({ fingerprint: undefined })

    open.resolve()
    await create
  })

  it('reports no wallet while the onchain scan runs on the already opened wallet', async () => {
    const open = holdOpen()
    const create = createWallet({ mnemonic: SEED, restore: true })
    workerRemote.isOpen.mockResolvedValue(true)
    workerRemote.getFingerprint.mockResolvedValue(OPENED.fingerprint)

    await expect(walletExists()).resolves.toStrictEqual({ fingerprint: undefined })

    open.resolve()
    await create
  })

  it('reports no wallet when a create starts while the check is reading storage', async () => {
    const open = holdOpen()
    let create: Promise<unknown> | undefined
    hasDatabaseMock.mockImplementation(async () => {
      create = createWallet({ mnemonic: SEED, restore: true })
      return await Promise.resolve(true)
    })

    await expect(walletExists()).resolves.toStrictEqual({ fingerprint: undefined })

    open.resolve()
    await create
  })

  it('reports the wallet once the create returns', async () => {
    const open = holdOpen()
    const create = createWallet({ mnemonic: SEED, restore: true })
    open.resolve()
    await create
    workerRemote.isOpen.mockResolvedValue(true)
    workerRemote.getFingerprint.mockResolvedValue(OPENED.fingerprint)

    await expect(walletExists()).resolves.toStrictEqual({ fingerprint: OPENED.fingerprint })
  })

  it('reports a stored wallet as locked again once a failed create settles', async () => {
    const open = holdOpen()
    const create = createWallet({ mnemonic: SEED, restore: true })
    open.reject(new Error('ark server unreachable'))
    await expect(create).rejects.toThrow('ark server unreachable')

    await expect(walletExists()).rejects.toBeInstanceOf(WalletLockedError)
  })
})
