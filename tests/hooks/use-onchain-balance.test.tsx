import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnchainBalance } from '../../src/hooks/barkd/use-onchain-balance'
import { useOnchainUtxos } from '../../src/hooks/barkd/use-onchain-utxos'
import { onchainApi } from '../../src/lib/barkd-client'
import { invalidateOnchainState } from '../../src/lib/query-invalidations'
import { onchainKeys } from '../../src/lib/query-keys'
import { hasPendingOffboards, usePendingOffboardsStore } from '../../src/stores/pending-offboards'
import { useWalletStore } from '../../src/stores/wallet'
import { FAST_REFETCH_MS, ONCHAIN_REFETCH_MS } from '../../src/constants/refetch'
import type { OnchainBalance } from '@/types/domain/balance'

const BALANCE: OnchainBalance = {
  confirmedSats: 0,
  immatureSats: 0,
  totalSats: 0,
  trustedPendingSats: 0,
  trustedSpendableSats: 0,
  untrustedPendingSats: 0
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Mirrors the thunk the onchain snapshot query passes to react-query.
// Asserting the predicate directly keeps the test off react-query's observer
// internals, where `refetchInterval` is not exposed on the cached query's
// options.
function pollInterval(): number {
  return hasPendingOffboards() ? FAST_REFETCH_MS : ONCHAIN_REFETCH_MS
}

describe('onchain poll interval', () => {
  let queryClient: QueryClient
  const balanceSpy = vi.spyOn(onchainApi, 'onchainBalance')
  const transactionsSpy = vi.spyOn(onchainApi, 'onchainTransactions')
  const utxosSpy = vi.spyOn(onchainApi, 'onchainUtxos')

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    balanceSpy.mockReset()
    balanceSpy.mockResolvedValue(BALANCE)
    transactionsSpy.mockReset()
    transactionsSpy.mockResolvedValue([])
    utxosSpy.mockReset()
    utxosSpy.mockResolvedValue([])
    useWalletStore.setState({
      wallet: { createdAt: '2026-01-01T00:00:00Z', fingerprint: 'fp', name: 'w' }
    })
    usePendingOffboardsStore.setState({ byFingerprint: {} })
  })

  afterEach(() => {
    queryClient.clear()
    usePendingOffboardsStore.setState({ byFingerprint: {} })
  })

  it('is the slow interval when no offboard is pending', () => {
    expect(pollInterval()).toBe(ONCHAIN_REFETCH_MS)
  })

  // An offboard's output is not in the wallet's onchain balance when the
  // mutation resolves — the round has to settle and broadcast first — so the
  // slow interval would leave "Pending on-chain" stale for a full cycle.
  it('is the fast interval while an offboard is pending', () => {
    usePendingOffboardsStore.getState().add('txid-1', Date.now())
    expect(pollInterval()).toBe(FAST_REFETCH_MS)
  })

  it('returns to the slow interval once the offboard txid is seen on-chain', () => {
    usePendingOffboardsStore.getState().add('txid-1', Date.now())
    usePendingOffboardsStore.getState().reconcile(['txid-1'], Date.now())
    expect(pollInterval()).toBe(ONCHAIN_REFETCH_MS)
  })

  // Both hooks select from the same snapshot query, so mounting them together
  // must produce exactly one fetch of each endpoint — one atomic cache write,
  // never a transactions list the balance does not reflect yet.
  it('serves both hooks from a single snapshot fetch', async () => {
    usePendingOffboardsStore.getState().add('txid-1', Date.now())
    const { result } = renderHook(
      () => ({ balance: useOnchainBalance(), utxos: useOnchainUtxos() }),
      { wrapper: makeWrapper(queryClient) }
    )
    await waitFor(() => {
      expect(result.current.balance.isSuccess).toBeTruthy()
      expect(result.current.utxos.isSuccess).toBeTruthy()
    })
    expect(balanceSpy).toHaveBeenCalledOnce()
    expect(transactionsSpy).toHaveBeenCalledOnce()
    expect(utxosSpy).toHaveBeenCalledOnce()
    expect(result.current.balance.data).toStrictEqual(BALANCE)
    expect(result.current.utxos.data).toStrictEqual([])
  })

  // Regression for the `cancelRefetch: false` defect: a mutation awaiting
  // invalidateOnchainState while a poll refetch is already in flight must not
  // join that request — its server read predates the mutation. The default
  // (`cancelRefetch: true`) aborts the in-flight fetch and issues a fresh one,
  // so the awaited invalidation always observes post-mutation data.
  it('invalidation during an in-flight fetch observes post-invalidation data', async () => {
    let serverPendingSats = 0
    const pendingFetches: (() => void)[] = []
    balanceSpy.mockImplementation(async () => {
      const requestTimeSats = serverPendingSats
      // oxlint-disable-next-line promise/avoid-new
      return await new Promise<OnchainBalance>((resolve) => {
        pendingFetches.push(() => {
          resolve({ ...BALANCE, untrustedPendingSats: requestTimeSats })
        })
      })
    })

    const { result } = renderHook(() => useOnchainBalance(), {
      wrapper: makeWrapper(queryClient)
    })
    await waitFor(() => {
      expect(pendingFetches).toHaveLength(1)
    })
    pendingFetches.shift()?.()
    await waitFor(() => {
      expect(result.current.data?.untrustedPendingSats).toBe(0)
    })

    const poll = queryClient.refetchQueries({ queryKey: onchainKeys.snapshot() })
    await waitFor(() => {
      expect(pendingFetches).toHaveLength(1)
    })

    serverPendingSats = 42_000
    const invalidated = invalidateOnchainState(queryClient)
    await waitFor(() => {
      expect(pendingFetches).toHaveLength(2)
    })
    for (const release of pendingFetches.splice(0)) {
      release()
    }
    await invalidated
    await poll
    await waitFor(() => {
      expect(result.current.data?.untrustedPendingSats).toBe(42_000)
    })
  })
})
