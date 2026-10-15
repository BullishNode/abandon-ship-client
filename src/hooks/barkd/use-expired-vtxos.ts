import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { config } from '@/config/runtime'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useOnchainTransactions } from '@/hooks/barkd/use-onchain-transactions'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { walletApi } from '@/lib/barkd-client'
import { invalidateMovementState } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import { useWalletStore } from '@/stores/wallet'
import { sumPayoutSats, unspentPayouts } from '@/utils/expiry-payout'
import type { ExpiryPayout } from '@/types/domain/expiry-payout'
import type { Vtxo } from '@/types/domain/vtxo'

export interface ExpiredVtxos {
  recoveryMode?: 'key-sweep' | 'wallet-fallback'
  recoveryUnknownIds?: Set<string>
  hasExpiredCoins?: boolean
  // False until the server status of the current expired coins is known.
  // Auto-refresh waits for it so it never submits a paid-out coin.
  isChecked: boolean
  isPayoutError: boolean
  refreshPayouts: () => void
  // Spent on the server, payout not seen on-chain yet.
  payingOutIds: Set<string>
  // Payout seen on-chain, not swept yet.
  payoutById: Map<string, ExpiryPayout>
  payouts: ExpiryPayout[]
  // Unswept payouts found on-chain. A coin the server reports spent is not
  // counted before its payout is seen: "spent" can also mean it was refreshed
  // or sent from another device.
  payingOutSat: number
  // Coins that must never be refreshed again.
  excludedIds: Set<string>
}

const NO_PAYOUTS: ExpiryPayout[] = []

export function getExpiredVtxos(vtxos: Vtxo[], tipHeight: number): Vtxo[] {
  return vtxos.filter((vtxo) => vtxo.state.type === 'spendable' && vtxo.expiryHeight <= tipHeight)
}

// Asks the server about the expired coins (a spent one is marked spent
// locally), then looks for their payouts. Either call may be missing on a stock
// barkd or older bindings; that only turns the check off, it never blocks
// auto-refresh.
async function checkExpiredVtxos(
  expired: Vtxo[],
  queryClient: QueryClient,
  strictRecovery: boolean
): Promise<boolean> {
  if (expired.length > 0) {
    try {
      const statuses = await walletApi.adoptServerVtxoStatus({
        vtxos: expired.map((vtxo) => vtxo.id)
      })
      if (strictRecovery) {
        const expected = new Set(expired.map((vtxo) => vtxo.id))
        const returned = new Set(statuses.map((status) => status.vtxoId))
        if (
          statuses.length !== expected.size || returned.size !== expected.size ||
          statuses.some((status) => !expected.has(status.vtxoId) ||
            !['spent', 'spendable'].includes(status.state))
        ) {
          return false
        }
      }
      const spentIds = statuses
        .filter((status) => status.state === 'spent')
        .map((status) => status.vtxoId)
      if (spentIds.length > 0) {
        const paidIds = new Set(
          queryClient
            .getQueryData<ExpiryPayout[]>(walletKeys.expiryPayouts())
            ?.map((payout) => payout.vtxoId)
        )
        useWalletStore.getState().addPayingOutIds(strictRecovery ? spentIds : spentIds.filter((id) => !paidIds.has(id)))
        await invalidateMovementState(queryClient)
      }
    } catch {
      // Preserve uncertain rights; a failed adoption is not a payout receipt.
      if (strictRecovery) return false
      // Unsupported or unreachable: the coins stay Renewing.
    }
  }
  return true
}

async function findPayouts(): Promise<ExpiryPayout[]> {
  const payouts = await walletApi.findExpiryPayouts()
  // From here on the payout itself is the record; a stored id would come
  // back as "paying out" once the payout is swept, from any client.
  useWalletStore
    .getState()
    .removePayingOutIds(
      payouts.flatMap((payout) => (payout.vtxoId === null ? [] : [payout.vtxoId]))
    )
  return payouts
}

export function useExpiredVtxos(): ExpiredVtxos {
  const queryClient = useQueryClient()
  const walletFallback = config.payoutRecoveryMode === 'wallet-fallback'
  const { data: tip } = useBitcoinTip()
  const { data: vtxos } = useVtxos()
  const { data: transactions } = useOnchainTransactions()
  const storedPayingOutIds = useWalletStore((state) => state.payingOutIds)

  const expired = tip === undefined ? [] : getExpiredVtxos(vtxos ?? [], tip)
  const statusKey = walletKeys.expiredVtxos(tip, expired.map((vtxo) => vtxo.id))
  const { data: isChecked = false } = useQuery({
    enabled: tip !== undefined && vtxos !== undefined,
    queryFn: async () => await checkExpiredVtxos(expired, queryClient, walletFallback),
    queryKey: walletFallback ? [...statusKey, 'wallet-fallback'] : statusKey,
    refetchInterval: 30_000,
    staleTime: Number.POSITIVE_INFINITY
  })

  // Keep the last successful scan across block/status changes and RPC errors.
  // An unavailable backend is not evidence that a payout was spent.
  const {
    data: payouts,
    isError: isPayoutError,
    isFetched,
    refetch
  } = useQuery({
    enabled: !walletFallback && tip !== undefined && vtxos !== undefined,
    queryFn: findPayouts,
    queryKey: walletKeys.expiryPayouts(),
    refetchInterval: 30_000,
    retry: false,
    staleTime: 30_000
  })

  const payoutList = useMemo(
    () => walletFallback ? NO_PAYOUTS : unspentPayouts(payouts ?? NO_PAYOUTS, transactions ?? []),
    [payouts, transactions, walletFallback]
  )
  const payoutById = new Map(
    payoutList.flatMap((payout) =>
      payout.vtxoId === null ? [] : [[payout.vtxoId, payout] as const]
    )
  )
  // Spent status alone cannot identify a payout. Keep every original id visible
  // as uncertain even when cash arrives at the current fallback address.
  const recoveryUnknownIds = new Set(walletFallback ? storedPayingOutIds : [])
  const payingOutIds = new Set(walletFallback ? [] : storedPayingOutIds.filter((id) => !payoutById.has(id)))
  return {
    recoveryMode: walletFallback ? 'wallet-fallback' : 'key-sweep',
    recoveryUnknownIds,
    hasExpiredCoins: expired.length > 0,
    excludedIds: new Set([...payingOutIds, ...payoutById.keys(), ...recoveryUnknownIds]),
    isChecked: isChecked && (walletFallback || isFetched),
    isPayoutError,
    payingOutIds,
    payingOutSat: sumPayoutSats(payoutList),
    payoutById,
    payouts: payoutList,
    refreshPayouts: () => {
      if (walletFallback) throw new Error('Separate payout scanning is unavailable for wallet fallback recovery')
      void refetch()
    }
  }
}
