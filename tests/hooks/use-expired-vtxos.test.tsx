import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useExpiredVtxos } from '../../src/hooks/barkd/use-expired-vtxos'
import { useSweepExpiryPayouts } from '../../src/hooks/barkd/use-sweep-expiry-payouts'
import { bitcoinApi, onchainApi, walletApi } from '../../src/lib/barkd-client'
import { useWalletStore } from '../../src/stores/wallet'
import { bitcoinKeys, walletKeys } from '../../src/lib/query-keys'
import type { ExpiryPayout } from '@/types/domain/expiry-payout'
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

const PAYOUT: ExpiryPayout = {
  amountSats: 9500,
  txid: 'payout-tx',
  vout: 0,
  vtxoId: 'old:0'
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useExpiredVtxos, () => {
  let queryClient: QueryClient
  const adoptSpy = vi.spyOn(walletApi, 'adoptServerVtxoStatus')
  const findSpy = vi.spyOn(walletApi, 'findExpiryPayouts')

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    vi.spyOn(bitcoinApi, 'tip').mockResolvedValue(TIP)
    vi.spyOn(walletApi, 'vtxos').mockResolvedValue([EXPIRED, FRESH])
    vi.spyOn(walletApi, 'balance').mockResolvedValue({
      claimableLightningReceiveSats: 0,
      pendingBoardSats: 0,
      pendingInRoundSats: 0,
      pendingLightningSendSats: 0,
      spendableSats: 0
    })
    adoptSpy.mockReset()
    findSpy.mockReset()
    useWalletStore.getState().clearWallet()
  })

  afterEach(() => {
    queryClient.clear()
    vi.useRealTimers()
  })

  function render() {
    return renderHook(() => useExpiredVtxos(), { wrapper: makeWrapper(queryClient) }).result
  }

  it('asks the server about expired coins only', async () => {
    adoptSpy.mockResolvedValue([{ state: 'spendable', vtxoId: 'old:0' }])
    findSpy.mockResolvedValue([])
    const result = render()

    await waitFor(() => {
      expect(result.current.isChecked).toBeTruthy()
    })
    expect(adoptSpy).toHaveBeenCalledWith({ vtxos: ['old:0'] })
    expect(result.current.excludedIds.size).toBe(0)
    expect(result.current.payingOutSat).toBe(0)
  })

  it('shows a coin the server reports spent as paying out', async () => {
    adoptSpy.mockResolvedValue([{ state: 'spent', vtxoId: 'old:0' }])
    findSpy.mockResolvedValue([])
    const result = render()

    await waitFor(() => {
      expect(result.current.payingOutIds.has('old:0')).toBeTruthy()
    })
    expect(result.current.payingOutSat).toBe(0)
    expect(result.current.excludedIds.has('old:0')).toBeTruthy()
    expect(useWalletStore.getState().payingOutIds).toStrictEqual(['old:0'])
  })

  it('moves a coin to paid out once its payout is on-chain', async () => {
    useWalletStore.getState().addPayingOutIds(['old:0'])
    adoptSpy.mockResolvedValue([])
    findSpy.mockResolvedValue([PAYOUT])
    const result = render()

    await waitFor(() => {
      expect(result.current.payoutById.get('old:0')).toStrictEqual(PAYOUT)
    })
    expect(result.current.payingOutIds.size).toBe(0)
    expect(result.current.payingOutSat).toBe(9500)
    expect(result.current.excludedIds.has('old:0')).toBeTruthy()
    expect(useWalletStore.getState().payingOutIds).toStrictEqual([])
  })

  it('does not bring a coin back as paying out after its payout was swept elsewhere', async () => {
    useWalletStore.getState().addPayingOutIds(['old:0'])
    adoptSpy.mockResolvedValue([])
    findSpy.mockResolvedValueOnce([PAYOUT]).mockResolvedValue([])
    const first = renderHook(() => useExpiredVtxos(), { wrapper: makeWrapper(queryClient) })
    await waitFor(() => {
      expect(first.result.current.payoutById.has('old:0')).toBeTruthy()
    })
    first.unmount()
    queryClient.clear()

    const result = render()
    await waitFor(() => {
      expect(result.current.isChecked).toBeTruthy()
    })
    expect(result.current.payingOutIds.size).toBe(0)
    expect(result.current.payingOutSat).toBe(0)
  })

  it('still finishes the check when the backend lacks the calls', async () => {
    adoptSpy.mockRejectedValue(new Error('not found'))
    findSpy.mockRejectedValue(new Error('not found'))
    const result = render()

    await waitFor(() => {
      expect(result.current.isChecked).toBeTruthy()
    })
    expect(result.current.excludedIds.size).toBe(0)
  })

  it('counts a shared-key output without attributing it to a historical coin', async () => {
    adoptSpy.mockResolvedValue([])
    findSpy.mockResolvedValue([{ ...PAYOUT, vtxoId: null }])
    const result = render()

    await waitFor(() => {
      expect(result.current.payingOutSat).toBe(9500)
    })
    expect(result.current.payoutById.size).toBe(0)
    expect(result.current.payouts).toHaveLength(1)
  })

  it.each(['same height', 'new height'])(
    'keeps the last known payout when a lookup fails at %s',
    async (height) => {
      adoptSpy.mockResolvedValue([])
      findSpy.mockResolvedValue([PAYOUT])
      const result = render()
      await waitFor(() => {
        expect(result.current.payingOutSat).toBe(9500)
      })

      findSpy.mockRejectedValue(new Error('bitcoind temporarily unavailable'))
      await act(async () => {
        if (height === 'new height') {
          queryClient.setQueryData(bitcoinKeys.tip(), TIP + 1)
        }
        await queryClient.invalidateQueries({ queryKey: walletKeys.expiredVtxosAll() })
      })
      await waitFor(() => {
        expect(findSpy).toHaveBeenCalledTimes(2)
      })
      expect(result.current.payingOutSat).toBe(9500)
    }
  )

  it('removes a successful sweep from the total even if the next lookup fails', async () => {
    adoptSpy.mockResolvedValue([])
    findSpy.mockResolvedValue([PAYOUT])
    vi.spyOn(onchainApi, 'sweepExpiryPayouts').mockResolvedValue({ sweptSats: 9300, txid: 'sweep' })
    const { result } = renderHook(
      () => ({ expiry: useExpiredVtxos(), sweep: useSweepExpiryPayouts() }),
      {
        wrapper: makeWrapper(queryClient)
      }
    )
    await waitFor(() => {
      expect(result.current.expiry.payingOutSat).toBe(9500)
    })
    findSpy.mockRejectedValue(new Error('bitcoind temporarily unavailable'))
    await act(async () => {
      await result.current.sweep.mutateAsync()
    })
    expect(queryClient.getQueryData(walletKeys.expiryPayouts())).toStrictEqual([])
    await waitFor(() => {
      expect(result.current.expiry.payingOutSat).toBe(0)
    })
    expect(result.current.expiry.payouts).toStrictEqual([])
  })

  it.each(['empty', 'failed'])(
    'finds a later mempool payout after an %s lookup at the same height',
    async (first) => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      adoptSpy.mockResolvedValue([])
      if (first === 'failed') {
        findSpy.mockRejectedValueOnce(new Error('temporarily unavailable')).mockResolvedValue([])
      } else {
        findSpy.mockResolvedValue([])
      }
      const result = render()
      await waitFor(() => {
        expect(result.current.isChecked).toBeTruthy()
      })
      expect(result.current.payingOutSat).toBe(0)

      findSpy.mockResolvedValue([PAYOUT])
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })
      expect(result.current.payingOutSat).toBe(9500)
      expect(result.current.payouts).toHaveLength(1)
    }
  )
})
