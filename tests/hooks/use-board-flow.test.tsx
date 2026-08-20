import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBoardFlow } from '../../src/hooks/use-board-flow'
import { boardsApi, feesApi, onchainApi, walletApi } from '../../src/lib/barkd-client'
import { krakenProvider } from '../../src/lib/price-providers/kraken'
import { feeKeys } from '../../src/lib/query-keys'
import type { ArkInfo } from '@/types/domain/ark'
import type { OnchainBalance } from '@/types/domain/balance'
import type { FeeEstimate } from '@/types/domain/fees'
import type { PriceData } from '@/types/price-providers'

const SPENDABLE_SATS = 100_000
const PARTIAL_AMOUNT_SATS = 50_000
const MIN_BOARD_AMOUNT_SATS = 5000
const DUST_EATING_FEE_SATS = 4800

const ONCHAIN_BALANCE: OnchainBalance = {
  confirmedSats: SPENDABLE_SATS,
  immatureSats: 0,
  totalSats: SPENDABLE_SATS,
  trustedPendingSats: 0,
  trustedSpendableSats: SPENDABLE_SATS,
  untrustedPendingSats: 0
}

const ARK_INFO: ArkInfo = {
  fees: {
    board: { baseFeeSats: 0, minFeeSats: 0, ppm: 0 },
    lightningReceive: { baseFeeSats: 0, ppm: 0 },
    lightningSend: { baseFeeSats: 0, minFeeSats: 0, ppmExpiryTable: [] },
    offboard: { baseFeeSats: 0, fixedAdditionalVb: 0, ppmExpiryTable: [] },
    refresh: { baseFeeSats: 0, ppmExpiryTable: [] }
  },
  htlcExpiryDelta: 6,
  htlcSendExpiryDelta: 6,
  lnReceiveAntiDosRequired: false,
  maxUserInvoiceCltvDelta: 144,
  maxVtxoExitDepth: 4,
  minBoardAmountSats: MIN_BOARD_AMOUNT_SATS,
  nbRoundNonces: 2,
  network: 'signet',
  requiredBoardConfirmations: 1,
  roundInterval: '30s',
  serverPubkey: '02deadbeef',
  vtxoExitDelta: 12,
  vtxoExpiryDelta: 144
}

const FEE: FeeEstimate = {
  feeSats: 500,
  grossAmountSats: SPENDABLE_SATS,
  netAmountSats: SPENDABLE_SATS - 500,
  vtxosSpent: []
}

const PRICE: PriceData = {
  change24h: 0,
  changePercent24h: 0,
  currentPrice: 100_000,
  priceHistory: [100_000]
}

const PARTIAL_FEE: FeeEstimate = {
  feeSats: 300,
  grossAmountSats: PARTIAL_AMOUNT_SATS,
  netAmountSats: PARTIAL_AMOUNT_SATS - 300,
  vtxosSpent: []
}

const DUST_FEE: FeeEstimate = {
  feeSats: DUST_EATING_FEE_SATS,
  grossAmountSats: MIN_BOARD_AMOUNT_SATS,
  netAmountSats: MIN_BOARD_AMOUNT_SATS - DUST_EATING_FEE_SATS,
  vtxosSpent: []
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useBoardFlow, () => {
  let queryClient: QueryClient
  const arkInfoSpy = vi.spyOn(walletApi, 'arkInfo')
  const boardFeeSpy = vi.spyOn(feesApi, 'boardFee')
  const boardAllSpy = vi.spyOn(boardsApi, 'boardAll')
  const boardAmountSpy = vi.spyOn(boardsApi, 'boardAmount')
  const onchainBalanceSpy = vi.spyOn(onchainApi, 'onchainBalance')
  const onchainTransactionsSpy = vi.spyOn(onchainApi, 'onchainTransactions')
  const onchainUtxosSpy = vi.spyOn(onchainApi, 'onchainUtxos')
  const fetchPriceSpy = vi.spyOn(krakenProvider, 'fetchPrice')

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    arkInfoSpy.mockReset()
    arkInfoSpy.mockResolvedValue(ARK_INFO)
    boardFeeSpy.mockReset()
    boardAllSpy.mockReset()
    boardAmountSpy.mockReset()
    onchainBalanceSpy.mockReset()
    onchainBalanceSpy.mockResolvedValue(ONCHAIN_BALANCE)
    onchainTransactionsSpy.mockReset()
    onchainTransactionsSpy.mockResolvedValue([])
    onchainUtxosSpy.mockReset()
    onchainUtxosSpy.mockResolvedValue([])
    fetchPriceSpy.mockReset()
    fetchPriceSpy.mockResolvedValue(PRICE)
  })

  afterEach(() => {
    queryClient.clear()
  })

  async function renderFlow() {
    const { result } = renderHook(
      () => useBoardFlow({ onOpenChange: vi.fn<(open: boolean) => void>(), open: true }),
      { wrapper: makeWrapper(queryClient) }
    )
    await waitFor(() => {
      expect(result.current.onchainSpendableSat).toBe(SPENDABLE_SATS)
    })
    return result
  }

  async function renderBoardFlow() {
    const result = await renderFlow()
    act(() => {
      result.current.setMax()
    })
    return result
  }

  it('blocks submit until the fee estimate matches the entered amount', async () => {
    const settle: { resolve?: (fee: FeeEstimate) => void } = {}
    boardFeeSpy.mockImplementation(
      async () =>
        // oxlint-disable-next-line promise/avoid-new
        await new Promise<FeeEstimate>((resolve) => {
          settle.resolve = resolve
        })
    )
    const result = await renderBoardFlow()

    expect(result.current.validation).toBe('valid')
    expect(result.current.canSubmit).toBeFalsy()
    act(() => {
      result.current.submit()
    })
    expect(boardAllSpy).not.toHaveBeenCalled()
    expect(boardAmountSpy).not.toHaveBeenCalled()

    await waitFor(() => {
      expect(settle.resolve).toBeDefined()
    })
    act(() => {
      settle.resolve?.(FEE)
    })
    await waitFor(() => {
      expect(result.current.canSubmit).toBeTruthy()
    })
    act(() => {
      result.current.submit()
    })
    await waitFor(() => {
      expect(boardAllSpy).toHaveBeenCalledOnce()
    })
  })

  it('keeps submit blocked when the fee estimate fails', async () => {
    boardFeeSpy.mockRejectedValue(new Error('fee estimate failed'))
    const result = await renderBoardFlow()

    await waitFor(() => {
      expect(result.current.isFetchingFee).toBeFalsy()
    })
    expect(result.current.canSubmit).toBeFalsy()
    act(() => {
      result.current.submit()
    })
    expect(boardAllSpy).not.toHaveBeenCalled()
    expect(boardAmountSpy).not.toHaveBeenCalled()
  })

  it('reports the fee error and recovers via retry', async () => {
    boardFeeSpy.mockRejectedValueOnce(new Error('fee estimate failed'))
    boardFeeSpy.mockResolvedValue(FEE)
    const result = await renderBoardFlow()

    await waitFor(() => {
      expect(result.current.isFeeError).toBeTruthy()
    })
    expect(result.current.canSubmit).toBeFalsy()

    act(() => {
      result.current.retryFeeEstimate()
    })
    await waitFor(() => {
      expect(result.current.isFeeError).toBeFalsy()
    })
    await waitFor(() => {
      expect(result.current.canSubmit).toBeTruthy()
    })
  })

  it('boards the entered amount once the estimate for it arrives', async () => {
    boardFeeSpy.mockResolvedValue(PARTIAL_FEE)
    const result = await renderFlow()

    act(() => {
      result.current.setAmount(String(PARTIAL_AMOUNT_SATS))
    })
    await waitFor(() => {
      expect(result.current.canSubmit).toBeTruthy()
    })
    expect(boardFeeSpy).toHaveBeenCalledWith({ amountSats: PARTIAL_AMOUNT_SATS })
    expect(result.current.feeSat).toBe(PARTIAL_FEE.feeSats)
    act(() => {
      result.current.submit()
    })
    await waitFor(() => {
      expect(boardAmountSpy).toHaveBeenCalledWith({ amountSats: PARTIAL_AMOUNT_SATS })
    })
    expect(boardAllSpy).not.toHaveBeenCalled()
  })

  it('blocks submit and reports below_dust when the fee eats the amount', async () => {
    boardFeeSpy.mockResolvedValue(DUST_FEE)
    const result = await renderFlow()

    act(() => {
      result.current.setAmount(String(MIN_BOARD_AMOUNT_SATS))
    })
    await waitFor(() => {
      expect(result.current.validation).toBe('below_dust')
    })
    expect(result.current.canSubmit).toBeFalsy()
    act(() => {
      result.current.submit()
    })
    expect(boardAllSpy).not.toHaveBeenCalled()
    expect(boardAmountSpy).not.toHaveBeenCalled()
  })

  it('keeps the last estimate and stays submittable when a refetch fails', async () => {
    boardFeeSpy.mockResolvedValueOnce(FEE)
    boardFeeSpy.mockRejectedValue(new Error('fee estimate failed'))
    const result = await renderBoardFlow()

    await waitFor(() => {
      expect(result.current.canSubmit).toBeTruthy()
    })
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: feeKeys.all })
    })
    await waitFor(() => {
      expect(queryClient.getQueryState(feeKeys.board(SPENDABLE_SATS))?.status).toBe('error')
    })

    expect(boardFeeSpy).toHaveBeenCalledTimes(2)
    expect(result.current.feeSat).toBe(FEE.feeSats)
    expect(result.current.isFeeError).toBeFalsy()
    expect(result.current.isFetchingFee).toBeFalsy()
    expect(result.current.canSubmit).toBeTruthy()
  })

  it('hides the fee error while a new amount is still being debounced', async () => {
    boardFeeSpy.mockRejectedValueOnce(new Error('fee estimate failed'))
    boardFeeSpy.mockResolvedValue(PARTIAL_FEE)
    const result = await renderBoardFlow()

    await waitFor(() => {
      expect(result.current.isFeeError).toBeTruthy()
    })
    expect(boardFeeSpy).toHaveBeenCalledWith({ amountSats: SPENDABLE_SATS })
    act(() => {
      result.current.setAmount(String(PARTIAL_AMOUNT_SATS))
    })

    expect(result.current.isFeeError).toBeFalsy()
    expect(result.current.isFetchingFee).toBeTruthy()
    expect(result.current.canSubmit).toBeFalsy()
    await waitFor(() => {
      expect(result.current.canSubmit).toBeTruthy()
    })
    expect(boardFeeSpy).toHaveBeenLastCalledWith({ amountSats: PARTIAL_AMOUNT_SATS })
    expect(result.current.feeSat).toBe(PARTIAL_FEE.feeSats)
    expect(result.current.isFeeError).toBeFalsy()
  })
})
