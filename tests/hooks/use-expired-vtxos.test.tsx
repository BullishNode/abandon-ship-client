import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useExpiredVtxos } from '../../src/hooks/barkd/use-expired-vtxos'
import { bitcoinApi, walletApi } from '../../src/lib/barkd-client'
import type { Vtxo } from '@/types/domain/vtxo'

const TIP = 1000

const EXPIRED: Vtxo = {
  amountSats: 10_000,
  expiryHeight: 990,
  id: 'old:0',
  state: { type: 'spendable' }
}
const FRESH: Vtxo = {
  amountSats: 5000,
  expiryHeight: 2000,
  id: 'new:0',
  state: { type: 'spendable' }
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useExpiredVtxos, () => {
  let queryClient: QueryClient
  const adoptSpy = vi.spyOn(walletApi, 'adoptServerVtxoStatus')
  const vtxosSpy = vi.spyOn(walletApi, 'vtxos')

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    vi.spyOn(bitcoinApi, 'tip').mockResolvedValue(TIP)
    vtxosSpy.mockReset()
    vtxosSpy.mockResolvedValue([EXPIRED, FRESH])
    adoptSpy.mockReset()
  })

  afterEach(() => {
    queryClient.clear()
  })

  function render() {
    return renderHook(() => useExpiredVtxos(), { wrapper: makeWrapper(queryClient) }).result
  }

  it('asks the server about expired coins only', async () => {
    adoptSpy.mockResolvedValue([{ state: 'spendable', vtxoId: 'old:0' }])
    const result = render()

    await waitFor(() => {
      expect(result.current.isChecked).toBeTruthy()
    })
    expect(adoptSpy).toHaveBeenCalledWith({ vtxos: ['old:0'] })
  })

  it('reloads the coins before finishing when the server reports one spent', async () => {
    adoptSpy.mockResolvedValue([{ state: 'spent', vtxoId: 'old:0' }])
    vtxosSpy.mockResolvedValueOnce([EXPIRED, FRESH]).mockResolvedValue([FRESH])
    const result = render()

    await waitFor(() => {
      expect(result.current.isChecked).toBeTruthy()
    })
    expect(vtxosSpy).toHaveBeenCalledTimes(2)
    expect(adoptSpy).toHaveBeenCalledOnce()
  })

  it('still finishes the check when the backend lacks the call', async () => {
    adoptSpy.mockRejectedValue(new Error('not found'))
    const result = render()

    await waitFor(() => {
      expect(result.current.isChecked).toBeTruthy()
    })
  })
})
