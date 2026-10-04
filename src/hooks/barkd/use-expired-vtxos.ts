import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { walletApi } from '@/lib/barkd-client'
import { invalidateMovementState } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import { useWalletStore } from '@/stores/wallet'
import { sumPayoutSats } from '@/utils/expiry-payout'
import type { ExpiryPayout } from '@/types/domain/expiry-payout'
import type { Vtxo } from '@/types/domain/vtxo'

export interface ExpiredVtxos {
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
async function checkExpiredVtxos(expired: Vtxo[], queryClient: QueryClient): Promise<boolean> {
  if (expired.length > 0) {
    try {
      const statuses = await walletApi.adoptServerVtxoStatus({
        vtxos: expired.map((vtxo) => vtxo.id)
      })
      const spentIds = statuses
        .filter((status) => status.state === 'spent')
        .map((status) => status.vtxoId)
      if (spentIds.length > 0) {
        const paidIds = new Set(
          queryClient
            .getQueryData<ExpiryPayout[]>(walletKeys.expiryPayouts())
            ?.map((payout) => payout.vtxoId)
        )
        useWalletStore.getState().addPayingOutIds(spentIds.filter((id) => !paidIds.has(id)))
        await invalidateMovementState(queryClient)
      }
    } catch {
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
  const { data: tip } = useBitcoinTip()
  const { data: vtxos } = useVtxos()
  const storedPayingOutIds = useWalletStore((state) => state.payingOutIds)

  const expired = tip === undefined ? [] : getExpiredVtxos(vtxos ?? [], tip)
  const { data: isChecked = false } = useQuery({
    enabled: tip !== undefined && vtxos !== undefined,
    queryFn: async () => await checkExpiredVtxos(expired, queryClient),
    queryKey: walletKeys.expiredVtxos(
      tip,
      expired.map((vtxo) => vtxo.id)
    ),
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
    enabled: tip !== undefined && vtxos !== undefined,
    queryFn: findPayouts,
    queryKey: walletKeys.expiryPayouts(),
    refetchInterval: 30_000,
    retry: false,
    staleTime: 30_000
  })

  const payoutList = payouts ?? NO_PAYOUTS
  const payoutById = new Map(
    payoutList.flatMap((payout) =>
      payout.vtxoId === null ? [] : [[payout.vtxoId, payout] as const]
    )
  )
  const payingOutIds = new Set(storedPayingOutIds.filter((id) => !payoutById.has(id)))
  return {
    excludedIds: new Set([...payingOutIds, ...payoutById.keys()]),
    isChecked: isChecked && isFetched,
    isPayoutError,
    payingOutIds,
    payingOutSat: sumPayoutSats(payoutList),
    payoutById,
    payouts: payoutList,
    refreshPayouts: () => {
      void refetch()
    }
  }
}
