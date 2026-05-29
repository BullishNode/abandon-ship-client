import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { QueryClient as QueryClientCtor } from '@tanstack/react-query'
import type { MockInstance } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  invalidateExitState,
  invalidateMovements,
  invalidateOnchainState,
  invalidateWalletExistence,
  invalidateWalletState,
  resetWalletQueriesAfterDelete
} from '../../src/lib/query-invalidations'
import { exitKeys, onchainKeys, walletKeys } from '../../src/lib/query-keys'

type InvalidateSpy = MockInstance<QueryClient['invalidateQueries']>
type RemoveSpy = MockInstance<QueryClient['removeQueries']>

describe('query invalidations', () => {
  let queryClient: QueryClient
  let invalidateSpy: InvalidateSpy
  let removeSpy: RemoveSpy

  beforeEach(() => {
    queryClient = new QueryClientCtor()
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    removeSpy = vi.spyOn(queryClient, 'removeQueries')
  })

  function invalidatedKeys(): (QueryKey | undefined)[] {
    const { calls } = invalidateSpy.mock
    return calls.map((call) => call[0]?.queryKey)
  }

  function removedKeys(): (QueryKey | undefined)[] {
    const { calls } = removeSpy.mock
    return calls.map((call) => call[0]?.queryKey)
  }

  describe(invalidateWalletState, () => {
    it('invalidates balance and transactions', async () => {
      await invalidateWalletState(queryClient)
      expect(invalidatedKeys()).toStrictEqual([walletKeys.balance(), walletKeys.transactions()])
    })
  })

  describe(invalidateMovements, () => {
    it('invalidates the wallet transactions key', async () => {
      await invalidateMovements(queryClient)
      expect(invalidatedKeys()).toStrictEqual([walletKeys.transactions()])
    })
  })

  describe(invalidateOnchainState, () => {
    it('invalidates onchain balance and transactions', async () => {
      await invalidateOnchainState(queryClient)
      expect(invalidatedKeys()).toStrictEqual([onchainKeys.balance(), onchainKeys.transactions()])
    })
  })

  describe(invalidateWalletExistence, () => {
    it('invalidates wallet existence key', async () => {
      await invalidateWalletExistence(queryClient)
      expect(invalidatedKeys()).toStrictEqual([walletKeys.exists()])
    })
  })

  describe(resetWalletQueriesAfterDelete, () => {
    it('removes wallet/exit caches and invalidates existence', async () => {
      await resetWalletQueriesAfterDelete(queryClient)
      expect(removedKeys()).toStrictEqual([
        walletKeys.autoCreate(),
        walletKeys.balance(),
        walletKeys.transactions(),
        exitKeys.all
      ])
      expect(invalidatedKeys()).toStrictEqual([walletKeys.exists()])
    })
  })

  describe(invalidateExitState, () => {
    it('invalidates exit, wallet, and onchain states', async () => {
      await invalidateExitState(queryClient)
      expect(invalidatedKeys()).toContainEqual(exitKeys.status())
      expect(invalidatedKeys()).toContainEqual(walletKeys.balance())
      expect(invalidatedKeys()).toContainEqual(onchainKeys.balance())
    })
  })
})
