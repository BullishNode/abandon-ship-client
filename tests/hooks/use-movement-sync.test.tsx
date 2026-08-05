import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMovementSync } from '../../src/hooks/barkd/use-movement-sync'
import { useBalanceTotals } from '../../src/hooks/use-balance-totals'
import { onchainApi, walletApi } from '../../src/lib/barkd-client'
import * as notificationsBus from '../../src/lib/notifications-bus'
import { useWalletStore } from '../../src/stores/wallet'
import { createMovement } from '../fixtures/movements'
import type { Balance, OnchainBalance } from '@/types/domain/balance'
import type { WalletNotification } from '@/types/domain/notification'

const PENDING_ONCHAIN_SATS = 5000
const BURST_SETTLE_MS = 600

const ONCHAIN_BALANCE: OnchainBalance = {
  confirmedSats: 0,
  immatureSats: 0,
  totalSats: PENDING_ONCHAIN_SATS,
  trustedPendingSats: 0,
  trustedSpendableSats: 0,
  untrustedPendingSats: PENDING_ONCHAIN_SATS
}

const BALANCE: Balance = {
  claimableLightningReceiveSats: 0,
  pendingBoardSats: 0,
  pendingExitSats: 0,
  pendingInRoundSats: 0,
  pendingLightningSendSats: 0,
  spendableSats: 1000
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe(useMovementSync, () => {
  let queryClient: QueryClient
  let emit: (notification: WalletNotification) => void
  const onchainBalanceSpy = vi.spyOn(onchainApi, 'onchainBalance')
  const onchainTransactionsSpy = vi.spyOn(onchainApi, 'onchainTransactions')
  const onchainUtxosSpy = vi.spyOn(onchainApi, 'onchainUtxos')
  const walletBalanceSpy = vi.spyOn(walletApi, 'balance')

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    onchainBalanceSpy.mockReset()
    onchainBalanceSpy.mockResolvedValue(ONCHAIN_BALANCE)
    onchainTransactionsSpy.mockReset()
    onchainTransactionsSpy.mockResolvedValue([])
    onchainUtxosSpy.mockReset()
    onchainUtxosSpy.mockResolvedValue([])
    walletBalanceSpy.mockReset()
    walletBalanceSpy.mockResolvedValue(BALANCE)
    useWalletStore.setState({
      wallet: { createdAt: '2026-01-01T00:00:00Z', fingerprint: 'fp', name: 'w' }
    })
    emit = () => {
      throw new Error('notification listener not registered')
    }
    vi.spyOn(notificationsBus, 'subscribeNotifications').mockImplementation((listener) => {
      emit = listener
      return () => {
        // nothing to assert on teardown
      }
    })
  })

  async function renderSynced() {
    const rendered = renderHook(
      () => {
        useMovementSync()
        return useBalanceTotals()
      },
      { wrapper: makeWrapper(queryClient) }
    )
    await waitFor(() => {
      expect(rendered.result.current.onchainPendingSat).toBe(PENDING_ONCHAIN_SATS)
    })
    return rendered
  }

  function callCounts() {
    return {
      onchainBalance: onchainBalanceSpy.mock.calls.length,
      onchainTransactions: onchainTransactionsSpy.mock.calls.length,
      onchainUtxos: onchainUtxosSpy.mock.calls.length,
      walletBalance: walletBalanceSpy.mock.calls.length
    }
  }

  async function emitBurst(count: number) {
    await act(async () => {
      for (let index = 0; index < count; index += 1) {
        emit({ movement: createMovement(), type: 'movement-updated' })
      }
      // oxlint-disable-next-line promise/avoid-new
      await new Promise((resolve) => {
        setTimeout(resolve, BURST_SETTLE_MS)
      })
    })
  }

  it('refreshes the onchain queries behind the balance card', async () => {
    await renderSynced()
    const before = callCounts()
    await emitBurst(1)
    const after = callCounts()
    expect(after.onchainBalance - before.onchainBalance).toBe(1)
    expect(after.onchainTransactions - before.onchainTransactions).toBe(1)
    expect(after.onchainUtxos - before.onchainUtxos).toBe(1)
    expect(after.walletBalance - before.walletBalance).toBe(1)
  })

  // The notification handler debounces invalidation, so a settling round's
  // burst must not fan out into one request per notification — one fresh
  // fetch after the burst ends.
  it('collapses a burst of notifications into a single refetch', async () => {
    await renderSynced()
    const before = callCounts()
    await emitBurst(10)
    const after = callCounts()
    expect(after.onchainBalance - before.onchainBalance).toBe(1)
    expect(after.walletBalance - before.walletBalance).toBe(1)
  })

  it('does not invalidate after unmount', async () => {
    const rendered = await renderSynced()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    act(() => {
      emit({ movement: createMovement(), type: 'movement-updated' })
    })
    rendered.unmount()

    await act(async () => {
      // oxlint-disable-next-line promise/avoid-new
      await new Promise((resolve) => {
        setTimeout(resolve, BURST_SETTLE_MS)
      })
    })

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
