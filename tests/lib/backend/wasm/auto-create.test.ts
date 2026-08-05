import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { autoCreateWasmWallet } from '@/lib/backend/wasm/auto-create'
import { openDeviceVault, saveDeviceVault } from '@/lib/backend/wasm/device-vault'
import { wasmBackend } from '@/lib/backend/wasm/client'
import type {
  CreateWalletParams,
  CreateWalletResult,
  DeleteWalletParams,
  DeleteWalletResult
} from '@/types/domain/wallet'

// The real client owns a worker; mock its wallet create/delete so the tests
// exercise only the auto-create invariants (vault-before-wallet,
// delete-on-failure). The rest of the backend surface stays real.
vi.mock(import('@/lib/backend/wasm/client'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    wasmBackend: {
      ...actual.wasmBackend,
      walletApi: {
        ...actual.wasmBackend.walletApi,
        createWallet: vi.fn<(params: CreateWalletParams) => Promise<CreateWalletResult>>(),
        walletDelete: vi.fn<(params: DeleteWalletParams) => Promise<DeleteWalletResult>>()
      }
    }
  }
})

const createWalletMock = vi.mocked(wasmBackend.walletApi.createWallet)
const walletDeleteMock = vi.mocked(wasmBackend.walletApi.walletDelete)

async function resetKeyDb(): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('bark-web-wasm-device-keys')
    request.addEventListener('success', () => {
      resolve()
    })
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('deleteDatabase failed'))
    })
  })
}

describe(autoCreateWasmWallet, () => {
  beforeEach(async () => {
    localStorage.clear()
    await resetKeyDb()
    createWalletMock.mockReset()
    walletDeleteMock.mockReset()
  })

  it('creates a wallet once the device vault verifies', async () => {
    // Mirror the real client, which persists the device vault during create.
    createWalletMock.mockImplementation(async ({ mnemonic }) => {
      await saveDeviceVault(mnemonic)
      return { fingerprint: 'f00dbabe' }
    })

    const result = await autoCreateWasmWallet()

    expect(result).toStrictEqual({ fingerprint: 'f00dbabe', outcome: 'created' })
    expect(createWalletMock).toHaveBeenCalledOnce()
    const persisted = await openDeviceVault()
    expect(persisted).toBe(createWalletMock.mock.calls[0]?.[0]?.mnemonic)
  })

  it('deletes the wallet when the device vault did not persist the mnemonic', async () => {
    createWalletMock.mockResolvedValue({ fingerprint: 'f00dbabe' })

    const result = await autoCreateWasmWallet()

    expect(result).toStrictEqual({ outcome: 'unsupported' })
    expect(walletDeleteMock).toHaveBeenCalledWith({ dangerous: true, fingerprint: 'f00dbabe' })
  })

  it('deletes the wallet when the vault holds a different mnemonic', async () => {
    createWalletMock.mockImplementation(async () => {
      await saveDeviceVault('completely different words')
      return { fingerprint: 'f00dbabe' }
    })

    const result = await autoCreateWasmWallet()

    expect(result).toStrictEqual({ outcome: 'unsupported' })
    expect(walletDeleteMock).toHaveBeenCalledOnce()
  })

  it('reports unsupported without creating anything when IndexedDB is unavailable', async () => {
    const original = indexedDB
    vi.stubGlobal('indexedDB', null)
    try {
      const result = await autoCreateWasmWallet()
      expect(result).toStrictEqual({ outcome: 'unsupported' })
      expect(createWalletMock).not.toHaveBeenCalled()
    } finally {
      vi.stubGlobal('indexedDB', original)
    }
  })

  it('propagates wallet-creation errors', async () => {
    createWalletMock.mockRejectedValue(new Error('ark server unreachable'))
    await expect(autoCreateWasmWallet()).rejects.toThrow('ark server unreachable')
  })
})
