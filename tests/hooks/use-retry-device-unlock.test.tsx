import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRetryDeviceUnlock } from '@/hooks/use-unlock-wallet'
import { tryDeviceUnlock } from '@/lib/backend/wasm'
import type { DeviceUnlockResult } from '@/lib/backend/wasm'
import { useAuthStore } from '@/stores/auth'

vi.mock(import('@/lib/backend/wasm'), () => ({
  clearVault: vi.fn<() => void>(),
  hasVault: vi.fn<() => boolean>(),
  saveDeviceVault: vi.fn<(mnemonic: string) => Promise<void>>(),
  tryDeviceUnlock: vi.fn<() => Promise<DeviceUnlockResult>>(),
  unlockWallet: vi.fn<(mnemonic: string) => Promise<void>>()
}))

const tryDeviceUnlockMock = vi.mocked(tryDeviceUnlock)

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useRetryDeviceUnlock, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ authRequired: true, authed: false, deviceUnlockFailed: true })
  })

  it('marks the session authed when the retry unlocks', async () => {
    tryDeviceUnlockMock.mockResolvedValue({ status: 'unlocked' })
    const { result } = renderHook(() => useRetryDeviceUnlock(), { wrapper: makeWrapper() })
    result.current.mutate()
    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })
    expect(useAuthStore.getState().authed).toBeTruthy()
    expect(useAuthStore.getState().deviceUnlockFailed).toBeFalsy()
  })

  it('surfaces a failed retry as a mutation error and stays locked', async () => {
    tryDeviceUnlockMock.mockResolvedValue({ error: new Error('esplora down'), status: 'failed' })
    const { result } = renderHook(() => useRetryDeviceUnlock(), { wrapper: makeWrapper() })
    result.current.mutate()
    await waitFor(() => {
      expect(result.current.isError).toBeTruthy()
    })
    expect(result.current.error?.message).toBe('esplora down')
    expect(useAuthStore.getState().authed).toBeFalsy()
  })

  it('returns no-vault without touching auth state so the caller can fall back', async () => {
    tryDeviceUnlockMock.mockResolvedValue({ status: 'no-vault' })
    const { result } = renderHook(() => useRetryDeviceUnlock(), { wrapper: makeWrapper() })
    result.current.mutate()
    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })
    expect(result.current.data).toBe('no-vault')
    expect(useAuthStore.getState().authed).toBeFalsy()
  })
})
