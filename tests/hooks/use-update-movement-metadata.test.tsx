import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { historyApi } from '../../src/lib/barkd-client'
import { useUpdateMovementMetadata } from '../../src/hooks/barkd/use-update-movement-metadata'
import { walletKeys } from '../../src/lib/query-keys'
import { createMovement } from '../fixtures/movements'
import type { Movement } from '@/types/domain/movement'

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useUpdateMovementMetadata, () => {
  let queryClient: QueryClient
  const updateMetadataSpy = vi.spyOn(historyApi, 'updateMetadata')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T00:00:00Z'))
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } }
    })
    updateMetadataSpy.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    queryClient.clear()
  })

  it('sends a JSON merge patch under the bark-web namespace', async () => {
    updateMetadataSpy.mockResolvedValue()
    const { result } = renderHook(() => useUpdateMovementMetadata(), {
      wrapper: makeWrapper(queryClient)
    })
    await act(async () => {
      await result.current.mutateAsync({ id: 42, patch: { label: 'coffee', tags: ['food'] } })
    })
    expect(updateMetadataSpy).toHaveBeenCalledOnce()
    const [firstCall] = updateMetadataSpy.mock.calls
    expect(firstCall[0]).toStrictEqual({
      id: 42,
      metadata: {
        'bark-web': {
          label: 'coffee',
          tags: ['food'],
          updatedAt: '2026-05-28T00:00:00.000Z'
        }
      }
    })
  })

  it('sends null for fields explicitly cleared via patch', async () => {
    updateMetadataSpy.mockResolvedValue()
    const { result } = renderHook(() => useUpdateMovementMetadata(), {
      wrapper: makeWrapper(queryClient)
    })
    await act(async () => {
      await result.current.mutateAsync({ id: 7, patch: { label: null, tags: null } })
    })
    const [firstCall] = updateMetadataSpy.mock.calls
    expect(firstCall[0].metadata).toMatchObject({ 'bark-web': { label: null, tags: null } })
  })

  it('optimistically merges patch fields into the cached transactions list', async () => {
    updateMetadataSpy.mockResolvedValue()
    const cached: Movement[] = [
      createMovement({ id: 1, metadata: { 'bark-web': { label: 'old', tags: ['t0'] } } }),
      createMovement({ id: 2 })
    ]
    queryClient.setQueryData(walletKeys.transactions(), cached)
    const { result } = renderHook(() => useUpdateMovementMetadata(), {
      wrapper: makeWrapper(queryClient)
    })
    await act(async () => {
      await result.current.mutateAsync({ id: 1, patch: { label: 'new' } })
    })
    const next = queryClient.getQueryData<Movement[]>(walletKeys.transactions())
    expect(next?.[0].metadata?.['bark-web']).toMatchObject({ label: 'new', tags: ['t0'] })
  })

  it('rolls back the cache when the request fails', async () => {
    updateMetadataSpy.mockRejectedValue(new Error('boom'))
    const cached: Movement[] = [
      createMovement({ id: 1, metadata: { 'bark-web': { label: 'old' } } })
    ]
    queryClient.setQueryData(walletKeys.transactions(), cached)
    const { result } = renderHook(() => useUpdateMovementMetadata(), {
      wrapper: makeWrapper(queryClient)
    })
    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 1, patch: { label: 'new' } })
      } catch {
        // expected
      }
    })
    const next = queryClient.getQueryData<Movement[]>(walletKeys.transactions())
    expect(next?.[0].metadata?.['bark-web']).toMatchObject({ label: 'old' })
  })
})
