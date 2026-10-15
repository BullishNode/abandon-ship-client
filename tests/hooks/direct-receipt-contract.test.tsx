import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useExpiredVtxos } from '@/hooks/barkd/use-expired-vtxos'
import { useBalanceTotals } from '@/hooks/use-balance-totals'
import { bitcoinApi, onchainApi, walletApi } from '@/lib/barkd-client'
import type { Vtxo } from '@/types/domain/vtxo'
import { getVtxoStatus } from '@/utils/vtxo'

// Current native REST has adopt-server-status and ordinary on-chain reads.
// It has no coin-key payout lookup or principal-sweep endpoint. This fixture
// checks the frontend contract only; it is not native or chain evidence.
describe('native direct receipt contract', () => {
  afterEach(() => vi.restoreAllMocks())

  it('adopts spent status without querying a removed payout route', async () => {
    const paths: string[] = []
    // oxlint-disable-next-line require-await
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      let path: string
      if (typeof input === 'string') {
        path = input
      } else if (input instanceof URL) {
        path = input.href
      } else {
        path = input.url
      }
      paths.push(path)
      if (path.endsWith('/wallet/vtxos/adopt-server-status')) {
        return Response.json([{ state: 'spent', vtxo_id: 'expired:0' }])
      }
      return new Response('not found', { status: 404 })
    })
    const expired: Vtxo = {
      amountSats: 20_000,
      expiryHeight: 990,
      id: 'expired:0',
      state: { type: 'spendable' }
    }
    vi.spyOn(bitcoinApi, 'tip').mockResolvedValue(1000)
    vi.spyOn(walletApi, 'vtxos')
      .mockResolvedValueOnce([expired])
      .mockResolvedValue([{ ...expired, state: { type: 'spent' } }])
    vi.spyOn(walletApi, 'balance').mockResolvedValue({
      claimableLightningReceiveSats: 0,
      pendingBoardSats: 0,
      pendingInRoundSats: 0,
      pendingLightningSendSats: 0,
      spendableSats: 0
    })
    vi.spyOn(onchainApi, 'onchainBalance').mockResolvedValue({
      confirmedSats: 19_000,
      totalSats: 19_000,
      trustedSpendableSats: 19_000
    })
    vi.spyOn(onchainApi, 'onchainTransactions').mockResolvedValue([])
    vi.spyOn(onchainApi, 'onchainUtxos').mockResolvedValue([])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    const hook = renderHook(() => ({ balance: useBalanceTotals(), expiry: useExpiredVtxos() }), {
      wrapper
    })
    try {
      await waitFor(() => expect(hook.result.current.expiry.status).toBe('checked'))
      await waitFor(() => expect(hook.result.current.balance.onchainSat).toBe(19_000))
      expect(paths.some((path) => path.endsWith('/wallet/vtxos/adopt-server-status'))).toBeTruthy()
      expect(paths.filter((path) => path.includes('expiry-payouts'))).toStrictEqual([])
      expect(hook.result.current.balance.totalSat).toBe(19_000)
    } finally {
      hook.unmount()
      queryClient.clear()
    }
  })

  it('does not label a generic server spend as a payout', () => {
    const spent: Vtxo = {
      amountSats: 20_000,
      expiryHeight: 990,
      id: 'spent-on-another-device:0',
      state: { type: 'spent' }
    }
    expect(getVtxoStatus(spent, 1000)).toBe('spent')
  })
})
