import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWalletTransactions } from '../../src/hooks/barkd/use-wallet-transactions'
import { historyApi } from '../../src/lib/barkd-client'
import { useMetadataStore } from '../../src/stores/metadata'
import { useWalletStore } from '../../src/stores/wallet'
import { createMovement } from '../fixtures/movements'
import type { Movement } from '@/types/domain/movement'

const TEST_FP = 'test-fingerprint'

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function resetStores() {
  useWalletStore.setState({
    exitClaimAddresses: {},
    isEmergencyExitAllInProgress: false,
    wallet: { createdAt: '2026-01-01T00:00:00.000Z', fingerprint: TEST_FP, name: 'Test' }
  })
  useMetadataStore.setState({
    bindings: {},
    contacts: [],
    onchainAnnotations: {},
    tags: []
  })
}

describe('useWalletTransactions promoteBindings', () => {
  let queryClient: QueryClient
  const listSpy = vi.spyOn(historyApi, 'list')
  const updateMetadataSpy = vi.spyOn(historyApi, 'updateMetadata')

  beforeEach(() => {
    resetStores()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    listSpy.mockReset()
    updateMetadataSpy.mockReset()
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('returns movements untouched when no bindings exist', async () => {
    const movements: Movement[] = [
      createMovement({
        effectiveBalanceSats: 100,
        id: 1,
        receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-a' }]
      })
    ]
    listSpy.mockResolvedValue(movements)
    const { result } = renderHook(() => useWalletTransactions(), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => expect(result.current.isSuccess).toBeTruthy())
    expect(result.current.data).toStrictEqual(movements)
    expect(updateMetadataSpy).not.toHaveBeenCalled()
  })

  it('promotes a matching binding, removes it from the store, and merges metadata into the returned movement', async () => {
    const bindingId = useMetadataStore.getState().upsertBinding({
      destinations: ['addr-a'],
      direction: 'incoming',
      label: 'Coffee',
      tags: ['food']
    })
    listSpy.mockResolvedValue([
      createMovement({
        effectiveBalanceSats: 100,
        id: 42,
        receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-a' }]
      })
    ])
    updateMetadataSpy.mockResolvedValue()
    const { result } = renderHook(() => useWalletTransactions(), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => expect(result.current.isSuccess).toBeTruthy())
    expect(updateMetadataSpy).toHaveBeenCalledOnce()
    const [firstCall] = updateMetadataSpy.mock.calls
    expect(firstCall[0].id).toBe(42)
    expect(firstCall[0].metadata).toMatchObject({
      'bark-web': { label: 'Coffee', tags: ['food'] }
    })
    expect(useMetadataStore.getState().bindings[TEST_FP] ?? []).toHaveLength(0)
    expect(result.current.data?.[0].metadata?.['bark-web']).toMatchObject({
      label: 'Coffee',
      tags: ['food']
    })
    expect(bindingId).toBeTruthy()
  })

  it('keeps the binding and leaves movement metadata untouched when updateMetadata rejects', async () => {
    useMetadataStore.getState().upsertBinding({
      destinations: ['addr-fail'],
      direction: 'incoming',
      label: 'Will fail',
      tags: []
    })
    listSpy.mockResolvedValue([
      createMovement({
        effectiveBalanceSats: 100,
        id: 7,
        receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-fail' }]
      })
    ])
    updateMetadataSpy.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useWalletTransactions(), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => expect(result.current.isSuccess).toBeTruthy())
    expect(updateMetadataSpy).toHaveBeenCalledOnce()
    expect(useMetadataStore.getState().bindings[TEST_FP] ?? []).toHaveLength(1)
    expect(result.current.data?.[0].metadata?.['bark-web']).toBeUndefined()
  })

  it('isolates failure: with allSettled, the fulfilled binding is removed and the rejected one is retained', async () => {
    const okId = useMetadataStore.getState().upsertBinding({
      destinations: ['addr-ok'],
      direction: 'incoming',
      label: 'Ok',
      tags: []
    })
    const failId = useMetadataStore.getState().upsertBinding({
      destinations: ['addr-fail'],
      direction: 'incoming',
      label: 'Fail',
      tags: []
    })
    listSpy.mockResolvedValue([
      createMovement({
        effectiveBalanceSats: 100,
        id: 1,
        receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-ok' }]
      }),
      createMovement({
        effectiveBalanceSats: 100,
        id: 2,
        receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-fail' }]
      })
    ])
    updateMetadataSpy.mockResolvedValueOnce().mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useWalletTransactions(), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => expect(result.current.isSuccess).toBeTruthy())
    expect(updateMetadataSpy).toHaveBeenCalledTimes(2)
    const remaining = useMetadataStore.getState().bindings[TEST_FP] ?? []
    expect(remaining.map((binding) => binding.id)).toStrictEqual([failId])
    expect(result.current.data?.[0].metadata?.['bark-web']).toMatchObject({ label: 'Ok' })
    expect(result.current.data?.[1].metadata?.['bark-web']).toBeUndefined()
    expect(okId).toBeTruthy()
  })

  it('skips movements that already carry bark-web metadata', async () => {
    useMetadataStore.getState().upsertBinding({
      destinations: ['addr-existing'],
      direction: 'incoming',
      label: 'New',
      tags: []
    })
    listSpy.mockResolvedValue([
      createMovement({
        effectiveBalanceSats: 100,
        id: 9,
        metadata: { 'bark-web': { label: 'Existing' } },
        receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-existing' }]
      })
    ])
    const { result } = renderHook(() => useWalletTransactions(), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => expect(result.current.isSuccess).toBeTruthy())
    expect(updateMetadataSpy).not.toHaveBeenCalled()
    expect(useMetadataStore.getState().bindings[TEST_FP] ?? []).toHaveLength(1)
    expect(result.current.data?.[0].metadata?.['bark-web']).toMatchObject({ label: 'Existing' })
  })
})
