import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { walletApi } from '@/lib/barkd-client'
import { invalidateMovementState } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import type { ServerVtxoStatus } from '@/types/domain/expiry-payout'
import type { Vtxo } from '@/types/domain/vtxo'

export function getExpiredVtxos(vtxos: Vtxo[], tipHeight: number): Vtxo[] {
  return vtxos.filter((vtxo) => vtxo.state.type === 'spendable' && vtxo.expiryHeight <= tipHeight)
}

export function unavailableExpiredIds(ids: string[], statuses: ServerVtxoStatus[]): Set<string> {
  const expected = new Set(ids)
  if (expected.size !== ids.length || statuses.length !== ids.length) {
    throw new Error('Expired coin status response is incomplete')
  }
  const seen = new Set<string>()
  const unavailable = new Set<string>()
  for (const status of statuses) {
    if (!expected.has(status.vtxoId) || seen.has(status.vtxoId)) {
      throw new Error('Expired coin status response does not match the requested coins')
    }
    seen.add(status.vtxoId)
    if (status.state !== 'spendable') {
      unavailable.add(status.vtxoId)
    }
  }
  return unavailable
}

export function useExpiredVtxos() {
  const queryClient = useQueryClient()
  const { data: tip } = useBitcoinTip()
  const { data: vtxos } = useVtxos()
  const expired = tip === undefined ? [] : getExpiredVtxos(vtxos ?? [], tip)
  const ids = expired.map((vtxo) => vtxo.id)
  const query = useQuery({
    enabled: tip !== undefined && vtxos !== undefined && ids.length > 0,
    queryFn: async () => {
      const statuses = await walletApi.adoptServerVtxoStatus({ vtxos: ids })
      const unavailable = unavailableExpiredIds(ids, statuses)
      if (statuses.some((status) => status.state === 'spent')) {
        await invalidateMovementState(queryClient)
      }
      return unavailable
    },
    queryKey: walletKeys.expiredVtxos(tip, ids),
    refetchInterval: 30_000,
    retry: false,
    staleTime: 30_000
  })
  const isChecked = tip !== undefined && vtxos !== undefined &&
    (ids.length === 0 || (query.isSuccess && !query.isFetching))
  return {
    // Unknown, unavailable or in-flight expired coins never enter a refresh.
    // Unrelated, unexpired coins can still use the existing refresh path.
    excludedIds: isChecked ? (query.data ?? new Set<string>()) : new Set(ids),
    isChecked,
    isStatusError: ids.length > 0 && query.isError,
    retryStatus: () => { void query.refetch() }
  }
}
