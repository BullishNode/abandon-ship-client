import { ResponseError } from '@secondts/barkd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmergencyExitVtxos } from '../../src/hooks/use-emergency-exit-vtxos'
import { exitsApi } from '../../src/lib/barkd-client'
import { useWalletStore } from '../../src/stores/wallet'
import type { Vtxo } from '@/types/domain/vtxo'

const ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'

const VTXOS: Vtxo[] = [
  { amountSats: 10_000, expiryHeight: 900_000, id: 'vtxo-1', state: { type: 'spendable' } }
]

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function barkdError(message: string): ResponseError {
  const response = Response.json({ message }, { status: 500 })
  return new ResponseError(response, 'Response returned an error code')
}

describe(useEmergencyExitVtxos, () => {
  let queryClient: QueryClient
  const startSpy = vi.spyOn(exitsApi, 'exitStartVtxos')
  vi.spyOn(exitsApi, 'emergencyExitFee').mockResolvedValue({
    claimFeeSats: 0,
    exitBroadcastFeeSats: 0,
    feeRateSatPerVb: 1,
    totalFeeSats: 0,
    txsToBroadcast: 0
  })

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    startSpy.mockReset()
    useWalletStore.getState().clearWallet()
  })

  afterEach(() => {
    queryClient.clear()
  })

  function renderFlow(onStarted: () => void) {
    const { result } = renderHook(
      () => useEmergencyExitVtxos(VTXOS, { isExitingAll: true, isOpen: false, onStarted }),
      { wrapper: makeWrapper(queryClient) }
    )
    return result
  }

  it('keeps the exit-all flag and claim address unset when the start fails', async () => {
    startSpy.mockRejectedValue(barkdError('simulated barkd failure'))
    const onStarted = vi.fn<() => void>()
    const result = renderFlow(onStarted)

    act(() => {
      result.current.handleSubmit(ADDRESS)
    })

    await waitFor(() => {
      expect(result.current.errorMessage).toBe('simulated barkd failure')
    })
    expect(onStarted).not.toHaveBeenCalled()
    expect(useWalletStore.getState().isEmergencyExitAllInProgress).toBeFalsy()
    expect(useWalletStore.getState().exitClaimAddresses).toStrictEqual({})
  })

  it('sets the exit-all flag and claim address once the exit started', async () => {
    startSpy.mockResolvedValue({ message: 'ok' })
    const onStarted = vi.fn<() => void>()
    const result = renderFlow(onStarted)

    act(() => {
      result.current.handleSubmit(ADDRESS)
    })

    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledOnce()
    })
    expect(useWalletStore.getState().isEmergencyExitAllInProgress).toBeTruthy()
    expect(useWalletStore.getState().exitClaimAddresses).toStrictEqual({ 'vtxo-1': ADDRESS })
  })
})
