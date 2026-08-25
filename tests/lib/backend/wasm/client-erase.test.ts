import type { wrap } from 'comlink'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const workerRemote = vi.hoisted(() => ({
  open: vi.fn<() => Promise<{ fingerprint: string; scanIncomplete: boolean }>>()
}))

// The client talks to the worker through Comlink; the guard interplay under
// test lives entirely on the client side, so `wrap` hands back a plain mock.
// The cast is unavoidable: a mock remote cannot satisfy the Remote<T> proxy
// type `wrap` promises.
vi.mock(import('comlink'), async (importOriginal) => ({
  ...(await importOriginal()),
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  wrap: (() => workerRemote) as unknown as typeof wrap
}))

vi.mock(import('@/lib/backend/wasm/idb'), () => ({
  canEnumerateDatabases: vi.fn<() => boolean>(() => false),
  deleteDatabase: vi.fn<(name: string) => Promise<boolean>>(),
  hasDatabase: vi.fn<(name: string) => Promise<boolean>>(),
  walletDatabaseNames: vi.fn<() => Promise<string[]>>()
}))

// Implementation-less mocks return undefined, which `await` tolerates — the
// erase path only needs clearDeviceVault to settle, not to produce a value.
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

const { deleteDatabase, walletDatabaseNames } = await import('@/lib/backend/wasm/idb')
const { eraseLockedWallet, unlockWallet } = await import('@/lib/backend/wasm/client')
const { useWalletStore } = await import('@/stores/wallet')

const deleteDatabaseMock = vi.mocked(deleteDatabase)
const walletDatabaseNamesMock = vi.mocked(walletDatabaseNames)

async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve()
  }
}

describe('eraseLockedWallet / unlockWallet guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    walletDatabaseNamesMock.mockResolvedValue(['bark-onchain-signet'])
    deleteDatabaseMock.mockResolvedValue(true)
    useWalletStore.setState({ wallet: null })
  })

  it('waits for an in-flight unlock to settle before deleting storage', async () => {
    let rejectOpen: ((reason: Error) => void) | undefined
    workerRemote.open.mockImplementation(
      async () =>
        // oxlint-disable-next-line promise/avoid-new
        await new Promise((_resolve, reject) => {
          rejectOpen = reject
        })
    )

    const unlock = unlockWallet('some wrong seed')
    const erase = eraseLockedWallet()
    await flushMicrotasks()
    expect(walletDatabaseNamesMock).not.toHaveBeenCalled()

    rejectOpen?.(new Error('descriptor mismatch'))
    await expect(unlock).rejects.toThrow('descriptor mismatch')
    await erase
    expect(walletDatabaseNamesMock).toHaveBeenCalledOnce()
    // deleteDatabase is passed to Array#map, so the call carries index/array too.
    expect(deleteDatabaseMock.mock.calls[0][0]).toBe('bark-onchain-signet')
  })

  it('rejects an unlock while a delete is in flight', async () => {
    let resolveNames: ((names: string[]) => void) | undefined
    walletDatabaseNamesMock.mockImplementation(
      async () =>
        // oxlint-disable-next-line promise/avoid-new
        await new Promise((resolve) => {
          resolveNames = resolve
        })
    )

    const erase = eraseLockedWallet()
    await expect(unlockWallet('any seed')).rejects.toThrow('Wallet is being deleted')
    expect(workerRemote.open).not.toHaveBeenCalled()

    resolveNames?.([])
    await erase
  })

  it('erases with the fingerprint from the persisted wallet store', async () => {
    useWalletStore.setState({
      wallet: { createdAt: '2026-01-01T00:00:00.000Z', fingerprint: 'cafebabe', name: 'stuck' }
    })

    await eraseLockedWallet()
    expect(walletDatabaseNamesMock).toHaveBeenCalledWith('bark-onchain-signet', 'cafebabe')
  })

  it('surfaces a blocked delete as an error', async () => {
    deleteDatabaseMock.mockResolvedValue(false)

    await expect(eraseLockedWallet()).rejects.toThrow(
      'Wallet storage could not be fully deleted. Close other tabs using this wallet and try again.'
    )
  })

  it('allows unlocking again after the delete settles', async () => {
    await eraseLockedWallet()
    workerRemote.open.mockResolvedValue({ fingerprint: 'f00dbabe', scanIncomplete: false })

    await unlockWallet('valid seed words')
    expect(workerRemote.open).toHaveBeenCalledOnce()
  })
})
