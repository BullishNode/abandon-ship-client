import { ResponseError } from '@secondts/barkd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoRefresh } from '../../src/hooks/barkd/use-auto-refresh'
import { bitcoinApi, walletApi } from '../../src/lib/barkd-client'
import { useRefreshFailuresStore } from '../../src/stores/refresh-failures'
import { bitcoinKeys, walletKeys } from '../../src/lib/query-keys'
import { ARK_INFO } from '../fixtures/ark-info'
import type { Vtxo } from '@/types/domain/vtxo'

const TIP = 1000

function expiring(id: string): Vtxo {
  return { amountSats: 1000, expiryHeight: TIP + 1, id, state: { type: 'spendable' } }
}

const EXPIRED: Vtxo = {
  amountSats: 1000,
  expiryHeight: TIP,
  id: 'old:0',
  state: { type: 'spendable' }
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
  const vtxosSpy = vi.spyOn(walletApi, 'vtxos')

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    vi.spyOn(bitcoinApi, 'tip').mockResolvedValue(TIP)
    vi.spyOn(walletApi, 'arkInfo').mockResolvedValue(ARK_INFO)
    vi.spyOn(walletApi, 'refreshingVtxos').mockResolvedValue([])
    vtxosSpy.mockReset()
    vtxosSpy.mockResolvedValue([expiring('good:0'), expiring('bad:0')])
    pendingRoundsSpy.mockResolvedValue([])
    refreshSpy.mockReset()
    refreshSpy.mockResolvedValue(null)
    adoptSpy.mockReset()
    adoptSpy.mockResolvedValue([])
    useRefreshFailuresStore.setState({ refusedAtHeight: {} })
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
    expect(useRefreshFailuresStore.getState().refusedAtHeight).toStrictEqual({ 'bad:0': TIP })
  })

  it('remembers the ids a rejected refresh call names', async () => {
    refreshSpy.mockRejectedValue(new Error('unusable inputs: [bad:0]'))
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => {
      expect(useRefreshFailuresStore.getState().refusedAtHeight).toStrictEqual({ 'bad:0': TIP })
    })
  })

  it('waits for the expired-coin check before refreshing', async () => {
    vtxosSpy.mockResolvedValue([expiring('good:0'), EXPIRED])
    // oxlint-disable-next-line promise/avoid-new
    adoptSpy.mockReturnValue(new Promise(() => {}))
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => {
      expect(adoptSpy).toHaveBeenCalledWith({ vtxos: ['old:0'] })
    })
    expect(refreshSpy).not.toHaveBeenCalled()
  })

  it('leaves out a coin the server already paid out', async () => {
    vtxosSpy
      .mockResolvedValueOnce([expiring('good:0'), EXPIRED])
      .mockResolvedValue([expiring('good:0'), { ...EXPIRED, state: { type: 'spent' } }])
    adoptSpy.mockResolvedValue([{ state: 'spent', vtxoId: 'old:0' }])
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledWith({ vtxos: ['good:0'] })
    })
    expect(refreshSpy).toHaveBeenCalledOnce()
  })

  it('leaves out expired coins but refreshes the others when the check errors', async () => {
    vtxosSpy.mockResolvedValue([expiring('good:0'), EXPIRED])
    adoptSpy.mockRejectedValue(new ResponseError(new Response(null, { status: 500 })))
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledWith({ vtxos: ['good:0'] })
    })
    expect(refreshSpy).toHaveBeenCalledOnce()
  })

  it('leaves out expired coins when the coins do not reload after a spent result', async () => {
    vtxosSpy
      .mockResolvedValueOnce([expiring('good:0'), EXPIRED])
      .mockRejectedValue(new TypeError('Failed to fetch'))
    adoptSpy.mockResolvedValue([{ state: 'spent', vtxoId: 'old:0' }])
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledWith({ vtxos: ['good:0'] })
    })
    expect(refreshSpy).toHaveBeenCalledOnce()
  })

  it('refreshes expired coins when the backend lacks the route', async () => {
    vtxosSpy.mockResolvedValue([expiring('good:0'), EXPIRED])
    adoptSpy.mockRejectedValue(new ResponseError(new Response(null, { status: 404 })))
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => {
      expect(refreshSpy).toHaveBeenCalledWith({ vtxos: ['good:0', 'old:0'] })
    })
  })

  it('retries at a new height even when an old failed round is still returned', async () => {
    const failed = { id: 1, status: { error: 'unusable inputs: [bad:0]', type: 'failed' as const } }
    pendingRoundsSpy.mockResolvedValue([failed])
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenLastCalledWith({ vtxos: ['good:0'] })
    })

    // A refetch can also add unrelated rounds; the old failure is not new evidence.
    act(() => {
      queryClient.setQueryData(walletKeys.pendingRounds(), [
        failed,
        { id: 2, status: { type: 'canceled' } }
      ])
      queryClient.setQueryData(bitcoinKeys.tip(), TIP + 1)
    })
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenLastCalledWith({ vtxos: ['good:0', 'bad:0'] })
    })
  })

  it('ages refusals per coin so a new refusal does not extend an older one', async () => {
    // oxlint-disable-next-line require-await
    refreshSpy.mockImplementation(async ({ vtxos }) => {
      if (vtxos.includes('bad:0')) {
        throw new Error('unusable inputs: [bad:0]')
      }
      return null
    })
    renderHook(() => useAutoRefresh(), { wrapper: makeWrapper(queryClient) })
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenLastCalledWith({ vtxos: ['good:0'] })
    })

    // oxlint-disable-next-line require-await
    refreshSpy.mockImplementation(async ({ vtxos }) => {
      if (vtxos.includes('good:0')) {
        throw new Error('unusable inputs: [good:0]')
      }
      return null
    })
    act(() => {
      queryClient.setQueryData(bitcoinKeys.tip(), TIP + 1)
    })
    await waitFor(() => {
      expect(refreshSpy).toHaveBeenLastCalledWith({ vtxos: ['bad:0'] })
    })
  })
})
