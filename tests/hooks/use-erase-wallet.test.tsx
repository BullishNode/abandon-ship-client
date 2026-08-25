import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEraseWallet } from '@/hooks/use-erase-wallet'
import { eraseLockedWallet } from '@/lib/backend/wasm'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'

vi.mock(import('@/lib/backend/wasm'), () => ({
  eraseLockedWallet: vi.fn<() => Promise<void>>()
}))

const eraseLockedWalletMock = vi.mocked(eraseLockedWallet)

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useEraseWallet, () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    useAuthStore.setState({ authRequired: true, authed: false })
    useWalletStore.setState({
      wallet: { createdAt: '2026-01-01T00:00:00.000Z', fingerprint: 'f00dbabe', name: 'stuck' }
    })
  })

  it('clears the wallet store and lifts the auth gate after a successful erase', async () => {
    eraseLockedWalletMock.mockResolvedValue()
    const { result } = renderHook(() => useEraseWallet(), { wrapper: makeWrapper(queryClient) })
    result.current.mutate()
    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })
    expect(eraseLockedWalletMock).toHaveBeenCalledOnce()
    expect(useWalletStore.getState().wallet).toBeNull()
    expect(useAuthStore.getState().authRequired).toBeFalsy()
    expect(useAuthStore.getState().authed).toBeTruthy()
  })

  it('keeps the gate locked and the wallet stored when the erase fails', async () => {
    eraseLockedWalletMock.mockRejectedValue(new Error('Close other tabs of this wallet'))
    const { result } = renderHook(() => useEraseWallet(), { wrapper: makeWrapper(queryClient) })
    result.current.mutate()
    await waitFor(() => {
      expect(result.current.isError).toBeTruthy()
    })
    expect(useWalletStore.getState().wallet?.fingerprint).toBe('f00dbabe')
    expect(useAuthStore.getState().authRequired).toBeTruthy()
    expect(useAuthStore.getState().authed).toBeFalsy()
  })
})
