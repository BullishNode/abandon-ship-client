import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useRemoveWalletPassword,
  useSetWalletPassword,
  useUnlockWithPassword
} from '@/hooks/use-wallet-password'
import { useUnlockWallet } from '@/hooks/use-unlock-wallet'
import {
  clearDeviceVault,
  clearVault,
  hasVault,
  openVault,
  saveDeviceVault,
  saveVault,
  unlockWallet
} from '@/lib/backend/wasm'
import { walletApi } from '@/lib/barkd-client'
import { useAuthStore } from '@/stores/auth'

const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'

vi.mock(import('@/lib/backend/wasm'), () => ({
  clearDeviceVault: vi.fn<() => Promise<void>>(),
  clearVault: vi.fn<() => void>(),
  hasVault: vi.fn<() => boolean>(),
  openVault: vi.fn<(password: string) => Promise<string>>(),
  saveDeviceVault: vi.fn<(mnemonic: string) => Promise<void>>(),
  saveVault: vi.fn<(mnemonic: string, password: string) => Promise<void>>(),
  unlockWallet: vi.fn<(mnemonic: string) => Promise<void>>()
}))

const openVaultMock = vi.mocked(openVault)
const saveVaultMock = vi.mocked(saveVault)
const clearVaultMock = vi.mocked(clearVault)
const hasVaultMock = vi.mocked(hasVault)
const saveDeviceVaultMock = vi.mocked(saveDeviceVault)
const clearDeviceVaultMock = vi.mocked(clearDeviceVault)
const unlockWalletMock = vi.mocked(unlockWallet)

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useSetWalletPassword, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ authRequired: true, authed: false })
  })

  it('saves the password vault, then drops the device vault', async () => {
    const mnemonicSpy = vi.spyOn(walletApi, 'mnemonic').mockResolvedValue(MNEMONIC)
    const { result } = renderHook(() => useSetWalletPassword(), { wrapper: makeWrapper() })

    result.current.mutate('a long enough password')
    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    expect(saveVaultMock).toHaveBeenCalledWith(MNEMONIC, 'a long enough password')
    expect(clearDeviceVaultMock).toHaveBeenCalledOnce()
    const saveOrder = saveVaultMock.mock.invocationCallOrder[0] ?? 0
    const clearOrder = clearDeviceVaultMock.mock.invocationCallOrder[0] ?? 0
    expect(saveOrder).toBeLessThan(clearOrder)
    mnemonicSpy.mockRestore()
  })
})

describe(useRemoveWalletPassword, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ authRequired: true, authed: false })
  })

  it('writes the device vault before dropping the password vault', async () => {
    openVaultMock.mockResolvedValue(MNEMONIC)
    const { result } = renderHook(() => useRemoveWalletPassword(), { wrapper: makeWrapper() })

    result.current.mutate('current password')
    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    expect(saveDeviceVaultMock).toHaveBeenCalledWith(MNEMONIC)
    const saveOrder = saveDeviceVaultMock.mock.invocationCallOrder[0] ?? 0
    const clearOrder = clearVaultMock.mock.invocationCallOrder[0] ?? 0
    expect(saveOrder).toBeLessThan(clearOrder)
  })

  it('keeps the password vault when the device vault write fails', async () => {
    openVaultMock.mockResolvedValue(MNEMONIC)
    saveDeviceVaultMock.mockRejectedValue(new Error('idb unavailable'))
    const { result } = renderHook(() => useRemoveWalletPassword(), { wrapper: makeWrapper() })

    result.current.mutate('current password')
    await waitFor(() => {
      expect(result.current.isError).toBeTruthy()
    })

    expect(clearVaultMock).not.toHaveBeenCalled()
  })
})

describe(useUnlockWithPassword, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ authRequired: true, authed: false })
  })

  it('unlocks with the vault mnemonic and marks the session authed', async () => {
    openVaultMock.mockResolvedValue(MNEMONIC)
    const { result } = renderHook(() => useUnlockWithPassword(), { wrapper: makeWrapper() })

    result.current.mutate('current password')
    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    expect(unlockWalletMock).toHaveBeenCalledWith(MNEMONIC)
    expect(useAuthStore.getState().authed).toBeTruthy()
  })
})

describe(useUnlockWallet, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ authRequired: true, authed: false })
  })

  it('saves a device vault after a passwordless mnemonic unlock', async () => {
    hasVaultMock.mockReturnValue(false)
    const { result } = renderHook(() => useUnlockWallet(), { wrapper: makeWrapper() })

    result.current.mutate({ mnemonic: MNEMONIC })
    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    expect(unlockWalletMock).toHaveBeenCalledWith(MNEMONIC)
    expect(saveDeviceVaultMock).toHaveBeenCalledWith(MNEMONIC)
    expect(clearVaultMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().authed).toBeTruthy()
  })

  it('clears the password vault on the forgot-password path, then re-arms auto-unlock', async () => {
    hasVaultMock.mockReturnValue(false)
    const { result } = renderHook(() => useUnlockWallet(), { wrapper: makeWrapper() })

    result.current.mutate({ clearPasswordVault: true, mnemonic: MNEMONIC })
    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    expect(clearVaultMock).toHaveBeenCalledOnce()
    expect(saveDeviceVaultMock).toHaveBeenCalledWith(MNEMONIC)
  })

  it('does not create a device vault while a password vault exists', async () => {
    hasVaultMock.mockReturnValue(true)
    const { result } = renderHook(() => useUnlockWallet(), { wrapper: makeWrapper() })

    result.current.mutate({ mnemonic: MNEMONIC })
    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    expect(saveDeviceVaultMock).not.toHaveBeenCalled()
  })

  it('still unlocks when the device vault write fails', async () => {
    hasVaultMock.mockReturnValue(false)
    saveDeviceVaultMock.mockRejectedValue(new Error('idb unavailable'))
    const { result } = renderHook(() => useUnlockWallet(), { wrapper: makeWrapper() })

    result.current.mutate({ mnemonic: MNEMONIC })
    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    expect(useAuthStore.getState().authed).toBeTruthy()
  })
})
