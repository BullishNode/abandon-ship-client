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
  // Spent on the server, payout not seen on-chain yet.
  payingOutIds: Set<string>
  // Payout seen on-chain, not swept yet.
  payoutById: Map<string, ExpiryPayout>
  payouts: ExpiryPayout[]
  // Paying-out coins plus unswept payouts: money on its way to the on-chain balance.
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
  queryClient: QueryClient
): Promise<ExpiryPayout[]> {
  if (expired.length > 0) {
    try {
      const statuses = await walletApi.adoptServerVtxoStatus({
        vtxos: expired.map((vtxo) => vtxo.id)
      })
      const spentIds = new Set(
        statuses.filter((status) => status.state === 'spent').map((status) => status.vtxoId)
      )
      if (spentIds.size > 0) {
        useWalletStore
          .getState()
          .addPayingOutVtxos(
            Object.fromEntries(
              expired
                .filter((vtxo) => spentIds.has(vtxo.id))
                .map((vtxo) => [vtxo.id, vtxo.amountSats])
            )
          )
        await invalidateMovementState(queryClient)
      }
    } catch {
      // Unsupported or unreachable: the coins stay Renewing.
    }
  }
  try {
    return await walletApi.findExpiryPayouts()
  } catch {
    return NO_PAYOUTS
  }
}

export function useExpiredVtxos(): ExpiredVtxos {
  const queryClient = useQueryClient()
  const { data: tip } = useBitcoinTip()
  const { data: vtxos } = useVtxos()
  const payingOutVtxos = useWalletStore((state) => state.payingOutVtxos)

  const expired = tip === undefined ? [] : getExpiredVtxos(vtxos ?? [], tip)
  const { data: payouts } = useQuery({
    enabled: tip !== undefined && vtxos !== undefined,
    queryFn: async () => await checkExpiredVtxos(expired, queryClient),
    queryKey: walletKeys.expiredVtxos(
      tip,
      expired.map((vtxo) => vtxo.id)
    ),
    staleTime: Number.POSITIVE_INFINITY
  })

  const payoutList = payouts ?? NO_PAYOUTS
  const payoutById = new Map(payoutList.map((payout) => [payout.vtxoId, payout]))
  const payingOutIds = new Set(Object.keys(payingOutVtxos).filter((id) => !payoutById.has(id)))
  let payingOutSat = 0
  for (const id of payingOutIds) {
    payingOutSat += payingOutVtxos[id] ?? 0
  }
  payingOutSat += sumPayoutSats(payoutList)
  return {
    excludedIds: new Set([...payingOutIds, ...payoutById.keys()]),
    isChecked: payouts !== undefined,
    payingOutIds,
    payingOutSat,
    payoutById,
    payouts: payoutList
  }
}
