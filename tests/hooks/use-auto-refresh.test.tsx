import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoRefresh } from '../../src/hooks/barkd/use-auto-refresh'
import { bitcoinApi, walletApi } from '../../src/lib/barkd-client'
import { useRefreshFailuresStore } from '../../src/stores/refresh-failures'
import { useWalletStore } from '../../src/stores/wallet'
import { ARK_INFO } from '../fixtures/ark-info'
import type { Vtxo } from '@/types/domain/vtxo'

const TIP = 1000

function expiring(id: string): Vtxo {
  return { amountSats: 1000, expiryHeight: TIP + 1, id, state: { type: 'spendable' } }
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useAutoRefresh, () => {
  let queryClient: QueryClient
  const refreshSpy = vi.spyOn(walletApi, 'refreshVtxos')
  const pendingRoundsSpy = vi.spyOn(walletApi, 'pendingRounds')
  const adoptSpy = vi.spyOn(walletApi, 'adoptServerVtxoStatus')
  const findSpy = vi.spyOn(walletApi, 'findExpiryPayouts')

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    vi.spyOn(bitcoinApi, 'tip').mockResolvedValue(TIP)
    vi.spyOn(walletApi, 'arkInfo').mockResolvedValue(ARK_INFO)
    vi.spyOn(walletApi, 'refreshingVtxos').mockResolvedValue([])
    vi.spyOn(walletApi, 'vtxos').mockResolvedValue([expiring('good:0'), expiring('bad:0')])
    pendingRoundsSpy.mockResolvedValue([])
    refreshSpy.mockReset()
    refreshSpy.mockResolvedValue(null)
    adoptSpy.mockReset()
    adoptSpy.mockResolvedValue([])
    findSpy.mockReset()
    findSpy.mockResolvedValue([])
    useRefreshFailuresStore.setState({ refusedVtxoIds: [] })
    useWalletStore.getState().clearWallet()
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('leaves a coin the server refused out of the batch', async () => {
    pendingRoundsSpy.mockResolvedValue([
      { id: 1, status: { error: 'unusable inputs: [bad:0]', type: 'failed' } }
    ])
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenLastCalledWith({ vtxos: ['good:0'] })
    })
    expect(useRefreshFailuresStore.getState().refusedVtxoIds).toStrictEqual(['bad:0'])
  })

  it('remembers the ids a rejected refresh call names', async () => {
    refreshSpy.mockRejectedValue(new Error('unusable inputs: [bad:0]'))
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => {
      expect(useRefreshFailuresStore.getState().refusedVtxoIds).toStrictEqual(['bad:0'])
    })
  })

  it('waits for the expired-coin check before refreshing', async () => {
    // oxlint-disable-next-line promise/avoid-new
    findSpy.mockReturnValue(new Promise(() => {}))
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => {
      expect(findSpy).toHaveBeenCalledWith()
    })
    expect(refreshSpy).not.toHaveBeenCalled()
  })

  it('leaves out a coin the server already paid out', async () => {
    findSpy.mockResolvedValue([
      { amountSats: 900, txid: 't', vout: 0, vtxoId: 'bad:0' }
    ])
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledWith({ vtxos: ['good:0'] })
    })
    expect(refreshSpy).toHaveBeenCalledOnce()
  })
})
