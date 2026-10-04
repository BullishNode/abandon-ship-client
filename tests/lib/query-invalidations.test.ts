import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { QueryClient as QueryClientCtor } from '@tanstack/react-query'
import type { MockInstance } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  invalidateBoardState,
  invalidateExitState,
  invalidateMovements,
  invalidateMovementState,
  invalidateOffboardState,
  invalidateOnchainState,
  invalidateWalletExistence,
  invalidateWalletState,
  resetWalletQueriesAfterDelete
} from '../../src/lib/query-invalidations'
import { exitKeys, onchainKeys, walletKeys } from '../../src/lib/query-keys'

type InvalidateSpy = MockInstance<QueryClient['invalidateQueries']>

describe('query invalidations', () => {
  let queryClient: QueryClient
  let invalidateSpy: InvalidateSpy

  beforeEach(() => {
    queryClient = new QueryClientCtor()
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  })

  function invalidatedKeys(): (QueryKey | undefined)[] {
    const { calls } = invalidateSpy.mock
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
    it('invalidates the onchain snapshot', async () => {
      await invalidateOnchainState(queryClient)
      expect(invalidatedKeys()).toStrictEqual([onchainKeys.snapshot()])
    })
  })

  describe(invalidateMovementState, () => {
    // A movement that settles on-chain (offboard, board, exit) moves value
    // between the onchain pending and spendable buckets of the balance card.
    // Without the onchain snapshot the card renders a confirmed movement as
    // pending until its own poll fires or the page is reloaded.
    it('invalidates the onchain snapshot backing the balance card', async () => {
      await invalidateMovementState(queryClient)
      expect(invalidatedKeys()).toContainEqual(onchainKeys.snapshot())
    })

    it('still invalidates the offchain movement queries', async () => {
      await invalidateMovementState(queryClient)
      expect(invalidatedKeys()).toContainEqual(walletKeys.balance())
      expect(invalidatedKeys()).toContainEqual(walletKeys.transactions())
      expect(invalidatedKeys()).toContainEqual(walletKeys.vtxos())
      expect(invalidatedKeys()).toContainEqual(walletKeys.vtxosAll())
    })
  })

  describe(invalidateOffboardState, () => {
    it('invalidates the onchain snapshot so pending exit change is recomputed', async () => {
      await invalidateOffboardState(queryClient)
      expect(invalidatedKeys()).toContainEqual(onchainKeys.snapshot())
    })
  })

  describe(invalidateBoardState, () => {
    it('invalidates the onchain snapshot', async () => {
      await invalidateBoardState(queryClient)
      expect(invalidatedKeys()).toContainEqual(onchainKeys.snapshot())
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
      const keys = [
        walletKeys.balance(),
        walletKeys.transactions(),
        walletKeys.expiryPayouts(),
        walletKeys.expiredVtxos(100, ['old-wallet-coin']),
        exitKeys.all
      ]
      for (const key of keys) {
        queryClient.setQueryData(key, ['old wallet data'])
      }
      await resetWalletQueriesAfterDelete(queryClient)
      for (const key of keys) {
        expect(queryClient.getQueryData(key)).toBeUndefined()
      }
      expect(invalidatedKeys()).toStrictEqual([walletKeys.exists()])
    })
  })

  describe(invalidateExitState, () => {
    it('invalidates exit, wallet, and onchain states', async () => {
      await invalidateExitState(queryClient)
      expect(invalidatedKeys()).toContainEqual(exitKeys.status())
      expect(invalidatedKeys()).toContainEqual(walletKeys.balance())
      expect(invalidatedKeys()).toContainEqual(onchainKeys.snapshot())
    })
  })
})
