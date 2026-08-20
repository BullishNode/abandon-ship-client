import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOffboardFlow } from '../../src/hooks/use-offboard-flow'
import { feesApi, walletApi } from '../../src/lib/barkd-client'
import { feeKeys } from '../../src/lib/query-keys'
import type { FeeEstimate } from '@/types/domain/fees'
import type { Vtxo } from '@/types/domain/vtxo'

const ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const INVALID_ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
const DEBOUNCE_SETTLE_MS = 600

const VTXOS: Vtxo[] = [
  { amountSats: 10_000, expiryHeight: 900_000, id: 'vtxo-1', state: { type: 'spendable' } }
]

const FEE: FeeEstimate = {
  feeSats: 400,
  grossAmountSats: 10_000,
  netAmountSats: 9600,
  vtxosSpent: ['vtxo-1']
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useOffboardFlow, () => {
  let queryClient: QueryClient
  const offboardFeeSpy = vi.spyOn(feesApi, 'offboardFee')
  const offboardVtxosSpy = vi.spyOn(walletApi, 'offboardVtxos')

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    offboardFeeSpy.mockReset()
    offboardVtxosSpy.mockReset()
    offboardVtxosSpy.mockResolvedValue({ offboardTxid: null })
  })

  afterEach(() => {
    queryClient.clear()
  })

  function renderOffboardFlow() {
    const { result } = renderHook(
      () =>
        useOffboardFlow({
          onOffboarded: vi.fn<() => void>(),
          onOpenChange: vi.fn<(open: boolean) => void>(),
          open: true,
          vtxos: VTXOS
        }),
      { wrapper: makeWrapper(queryClient) }
    )
    return result
  }

  it('blocks submit until the fee estimate matches the entered address', async () => {
    const settle: { resolve?: (fee: FeeEstimate) => void } = {}
    offboardFeeSpy.mockImplementation(
      async () =>
        // oxlint-disable-next-line promise/avoid-new
        await new Promise<FeeEstimate>((resolve) => {
          settle.resolve = resolve
        })
    )
    const result = renderOffboardFlow()

    act(() => {
      result.current.setAddress(ADDRESS)
    })
    expect(result.current.canSubmit).toBeFalsy()
    act(() => {
      result.current.submit()
    })
    expect(offboardVtxosSpy).not.toHaveBeenCalled()

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
      expect(offboardVtxosSpy).toHaveBeenCalledWith({ address: ADDRESS, vtxos: ['vtxo-1'] })
    })
  })

  it('keeps submit blocked when the fee estimate fails', async () => {
    offboardFeeSpy.mockRejectedValue(new Error('fee estimate failed'))
    const result = renderOffboardFlow()

    act(() => {
      result.current.setAddress(ADDRESS)
    })
    await waitFor(() => {
      expect(result.current.isFetchingFee).toBeFalsy()
    })
    expect(result.current.canSubmit).toBeFalsy()
    act(() => {
      result.current.submit()
    })
    expect(offboardVtxosSpy).not.toHaveBeenCalled()
  })

  it('reports the fee error and recovers via retry', async () => {
    offboardFeeSpy.mockRejectedValueOnce(new Error('fee estimate failed'))
    offboardFeeSpy.mockResolvedValue(FEE)
    const result = renderOffboardFlow()

    act(() => {
      result.current.setAddress(ADDRESS)
    })
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

  it('keeps the last estimate usable when a refetch fails', async () => {
    offboardFeeSpy.mockResolvedValueOnce(FEE)
    offboardFeeSpy.mockRejectedValue(new Error('fee estimate failed'))
    const result = renderOffboardFlow()

    act(() => {
      result.current.setAddress(ADDRESS)
    })
    await waitFor(() => {
      expect(result.current.feeSat).toBe(FEE.feeSats)
    })

    act(() => {
      result.current.retryFeeEstimate()
    })
    await waitFor(() => {
      expect(queryClient.getQueryState(feeKeys.offboard(ADDRESS, ['vtxo-1']))?.status).toBe('error')
    })
    expect(result.current.isFeeError).toBeFalsy()
    expect(result.current.feeSat).toBe(FEE.feeSats)
    expect(result.current.canSubmit).toBeTruthy()
  })

  it('blocks submit and the fee estimate for an invalid address', async () => {
    const result = renderOffboardFlow()

    act(() => {
      result.current.setAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')
    })
    await waitFor(() => {
      expect(result.current.isAddressInvalid).toBeTruthy()
    })
    expect(result.current.canSubmit).toBeFalsy()
    act(() => {
      result.current.submit()
    })
    expect(offboardVtxosSpy).not.toHaveBeenCalled()
    expect(offboardFeeSpy).not.toHaveBeenCalled()
  })

  it('never requests a fee for a superseded invalid address', async () => {
    offboardFeeSpy.mockResolvedValue(FEE)
    const result = renderOffboardFlow()

    act(() => {
      result.current.setAddress(INVALID_ADDRESS)
    })
    await act(async () => {
      // oxlint-disable-next-line promise/avoid-new
      await new Promise((resolve) => {
        setTimeout(resolve, DEBOUNCE_SETTLE_MS)
      })
    })
    act(() => {
      result.current.setAddress(ADDRESS)
    })
    await waitFor(() => {
      expect(result.current.feeSat).toBe(FEE.feeSats)
    })
    expect(offboardFeeSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ address: INVALID_ADDRESS })
    )
    expect(offboardFeeSpy).toHaveBeenCalledOnce()
  })

  it('allows submit with an empty address without a fee estimate', async () => {
    const result = renderOffboardFlow()

    expect(result.current.canSubmit).toBeTruthy()
    act(() => {
      result.current.submit()
    })
    await waitFor(() => {
      expect(offboardVtxosSpy).toHaveBeenCalledWith({ address: undefined, vtxos: ['vtxo-1'] })
    })
    expect(offboardFeeSpy).not.toHaveBeenCalled()
  })
})
