import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { unavailableExpiredIds, useExpiredVtxos } from '@/hooks/barkd/use-expired-vtxos'
import { bitcoinApi, walletApi } from '@/lib/barkd-client'
import type { Vtxo } from '@/types/domain/vtxo'

const EXPIRED: Vtxo = { amountSats: 10_000, expiryHeight: 990, id: 'old:0', state: { type: 'spendable' } }
const FRESH: Vtxo = { amountSats: 5000, expiryHeight: 2000, id: 'new:0', state: { type: 'spendable' } }

describe('expired coin admission', () => {
  it('admits only an exact, explicitly spendable response', () => {
    expect([...unavailableExpiredIds(['a', 'b', 'c', 'd'], [
      { vtxoId: 'a', state: 'spendable' }, { vtxoId: 'b', state: 'spent' },
      { vtxoId: 'c', state: 'unregistered' }, { vtxoId: 'd', state: 'future-state' }
    ])]).toStrictEqual(['b', 'c', 'd'])
  })
  it('rejects partial, duplicate and foreign responses instead of treating them as spendable', () => {
    expect(() => unavailableExpiredIds(['a'], [])).toThrow()
    expect(() => unavailableExpiredIds(['a', 'b'], [
      { vtxoId: 'a', state: 'spendable' }, { vtxoId: 'a', state: 'spendable' }
    ])).toThrow()
    expect(() => unavailableExpiredIds(['a'], [{ vtxoId: 'foreign', state: 'spendable' }])).toThrow()
  })
})

describe(useExpiredVtxos, () => {
  let queryClient: QueryClient
  const adoptSpy = vi.spyOn(walletApi, 'adoptServerVtxoStatus')
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.spyOn(bitcoinApi, 'tip').mockResolvedValue(1000)
    vi.spyOn(walletApi, 'vtxos').mockResolvedValue([EXPIRED, FRESH])
    adoptSpy.mockReset()
  })
  afterEach(() => { queryClient.clear() })
  function render() {
    return renderHook(() => useExpiredVtxos(), { wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ) }).result
  }
  it('keeps expired inputs out while the actual response is unavailable', async () => {
    adoptSpy.mockReturnValue(new Promise(() => {}))
    const result = render()
    await waitFor(() => { expect(adoptSpy).toHaveBeenCalledWith({ vtxos: ['old:0'] }) })
    expect(result.current.isChecked).toBeFalsy()
    expect(result.current.excludedIds.has('old:0')).toBeTruthy()
    expect(result.current.excludedIds.has('new:0')).toBeFalsy()
  })
  it('surfaces transport failure without authorizing expired refresh', async () => {
    adoptSpy.mockRejectedValue(new Error('unreachable'))
    const result = render()
    await waitFor(() => { expect(result.current.isStatusError).toBeTruthy() })
    expect(result.current.isChecked).toBeFalsy()
    expect(result.current.excludedIds.has('old:0')).toBeTruthy()
    expect(result.current.excludedIds.has('new:0')).toBeFalsy()
  })
  it('allows a verified spendable expired coin after the original status check', async () => {
    adoptSpy.mockResolvedValue([{ vtxoId: 'old:0', state: 'spendable' }])
    const result = render()
    await waitFor(() => { expect(result.current.isChecked).toBeTruthy() })
    expect(result.current.excludedIds.size).toBe(0)
    expect(result.current).not.toHaveProperty('payoutById')
  })
  it('does not reuse stale spendable approval after a failed status recheck', async () => {
    adoptSpy.mockResolvedValueOnce([{ vtxoId: 'old:0', state: 'spendable' }])
    const result = render()
    await waitFor(() => { expect(result.current.isChecked).toBeTruthy() })
    adoptSpy.mockRejectedValue(new Error('now unavailable'))
    act(() => { result.current.retryStatus() })
    await waitFor(() => { expect(result.current.isStatusError).toBeTruthy() })
    expect(result.current.excludedIds.has('old:0')).toBeTruthy()
    expect(result.current.isChecked).toBeFalsy()
  })
})
