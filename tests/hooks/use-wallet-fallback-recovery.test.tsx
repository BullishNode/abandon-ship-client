import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { config } from '@/config/runtime'
import { useExpiredVtxos } from '@/hooks/barkd/use-expired-vtxos'
import { bitcoinApi, onchainApi, walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'
import { useWalletStore } from '@/stores/wallet'
import { getVtxoStatus } from '@/utils/vtxo'
const expired = { id: 'old:0', amountSats: 1000, expiryHeight: 90, state: { type: 'spendable' as const } }

describe('ordinary wallet fallback recovery', () => {
  let queryClient: QueryClient
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.spyOn(config, 'payoutRecoveryMode', 'get').mockReturnValue('wallet-fallback')
    vi.spyOn(bitcoinApi, 'tip').mockResolvedValue(100)
    vi.spyOn(walletApi, 'vtxos').mockResolvedValue([expired])
    vi.spyOn(walletApi, 'findExpiryPayouts').mockRejectedValue(new Error('unsupported route must never be called'))
    vi.spyOn(onchainApi, 'onchainBalance').mockResolvedValue({ confirmedSats: 1000, totalSats: 1000 })
    vi.spyOn(onchainApi, 'onchainTransactions').mockResolvedValue([])
    vi.spyOn(onchainApi, 'onchainUtxos').mockResolvedValue([])
    useWalletStore.getState().clearWallet()
  })
  afterEach(() => { queryClient.clear(); vi.restoreAllMocks() })
  function render() {
    return renderHook(() => useExpiredVtxos(), { wrapper: ({ children }: { children: ReactNode }) =>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> }).result
  }
  it('preserves server-spent ids as unverified without unsupported scanning or extra cash', async () => {
    vi.spyOn(walletApi, 'adoptServerVtxoStatus').mockResolvedValue([{ vtxoId: 'old:0', state: 'spent' }])
    const result = render()
    await waitFor(() => expect(result.current.isChecked).toBe(true))
    expect(result.current.recoveryUnknownIds).toStrictEqual(new Set(['old:0']))
    expect(result.current.excludedIds).toStrictEqual(new Set(['old:0']))
    expect(result.current.payingOutIds.size).toBe(0)
    expect(result.current.payingOutSat).toBe(0)
    expect(getVtxoStatus(expired, 100, result.current)).toBe('recovery_unknown')
    expect(walletApi.findExpiryPayouts).not.toHaveBeenCalled()
  })
  it('does not clear an original unknown id using a cached old payout or ordinary cash', async () => {
    useWalletStore.getState().addPayingOutIds(['old:0'])
    queryClient.setQueryData(walletKeys.expiryPayouts(), [{ vtxoId: 'old:0', amountSats: 1000 }])
    vi.spyOn(walletApi, 'adoptServerVtxoStatus').mockResolvedValue([{ vtxoId: 'old:0', state: 'spent' }])
    const result = render()
    await waitFor(() => expect(result.current.isChecked).toBe(true))
    expect(useWalletStore.getState().payingOutIds).toStrictEqual(['old:0'])
    expect(result.current.recoveryUnknownIds).toStrictEqual(new Set(['old:0']))
    expect(result.current.payouts).toStrictEqual([])
  })
  it.each([
    { statuses: [] },
    { statuses: [{ vtxoId: 'foreign:0', state: 'spent' }] },
    { statuses: [{ vtxoId: 'old:0', state: 'spent' }, { vtxoId: 'old:0', state: 'spent' }] },
    { statuses: [{ vtxoId: 'old:0', state: 'other' }] },
    { statuses: [{ vtxoId: 'old:0', state: 'unregistered' }] }
  ])('holds incomplete, duplicate or unresolved status evidence: $statuses', async ({ statuses }) => {
    const spy = vi.spyOn(walletApi, 'adoptServerVtxoStatus').mockResolvedValue(statuses)
    const result = render()
    await waitFor(() => expect(queryClient.getQueryData([...walletKeys.expiredVtxos(100, ['old:0']), 'wallet-fallback'])).toBe(false))
    expect(spy).toHaveBeenCalled()
    expect(result.current.isChecked).toBe(false)
    expect(walletApi.findExpiryPayouts).not.toHaveBeenCalled()
  })
  it('does not reuse a cached legacy status check as strict recovery evidence', async () => {
    queryClient.setQueryData(walletKeys.expiredVtxos(100, ['old:0']), true)
    const spy = vi.spyOn(walletApi, 'adoptServerVtxoStatus').mockResolvedValue([])
    const result = render()
    await waitFor(() => expect(queryClient.getQueryData([...walletKeys.expiredVtxos(100, ['old:0']), 'wallet-fallback'])).toBe(false))
    expect(spy).toHaveBeenCalled()
    expect(result.current.isChecked).toBe(false)
  })
  it('preserves existing unknown ids when adoption fails', async () => {
    useWalletStore.getState().addPayingOutIds(['prior:0'])
    const spy = vi.spyOn(walletApi, 'adoptServerVtxoStatus').mockRejectedValue(new Error('offline'))
    const result = render()
    await waitFor(() => expect(queryClient.getQueryData([...walletKeys.expiredVtxos(100, ['old:0']), 'wallet-fallback'])).toBe(false))
    expect(spy).toHaveBeenCalled()
    expect(result.current.isChecked).toBe(false)
    expect(result.current.recoveryUnknownIds).toStrictEqual(new Set(['prior:0']))
  })
})
