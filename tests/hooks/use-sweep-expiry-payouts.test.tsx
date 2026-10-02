import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSweepExpiryPayouts } from '../../src/hooks/barkd/use-sweep-expiry-payouts'
import { onchainApi } from '../../src/lib/barkd-client'
import { useWalletStore } from '../../src/stores/wallet'

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useSweepExpiryPayouts, () => {
  let queryClient: QueryClient
  const sweepSpy = vi.spyOn(onchainApi, 'sweepExpiryPayouts')

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    sweepSpy.mockReset()
    useWalletStore.getState().clearWallet()
    useWalletStore.getState().addPayingOutVtxos({ 'a:0': 1000, 'b:0': 2000 })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('stops tracking the swept coins as paying out', async () => {
    sweepSpy.mockResolvedValue({ sweptSats: 900, txid: 's' })
    const { result } = renderHook(() => useSweepExpiryPayouts(), {
      wrapper: makeWrapper(queryClient)
    })

    act(() => {
      result.current.mutate({ vtxoIds: ['a:0'] })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })
    expect(useWalletStore.getState().payingOutVtxos).toStrictEqual({ 'b:0': 2000 })
  })

  it('keeps them when the sweep fails', async () => {
    sweepSpy.mockRejectedValue(new Error('no payouts'))
    const { result } = renderHook(() => useSweepExpiryPayouts(), {
      wrapper: makeWrapper(queryClient)
    })

    act(() => {
      result.current.mutate({ vtxoIds: ['a:0'] })
    })

    await waitFor(() => {
      expect(result.current.isError).toBeTruthy()
    })
    expect(useWalletStore.getState().payingOutVtxos).toStrictEqual({ 'a:0': 1000, 'b:0': 2000 })
  })
})
