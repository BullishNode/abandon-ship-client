import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { walletApi } from '@/lib/barkd-client'
import { invalidateMovementState } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import type { Vtxo } from '@/types/domain/vtxo'

export interface ExpiredVtxos {
  // False until the server status of the current expired coins is known.
  // Auto-refresh waits for it so it never submits a paid-out coin.
  isChecked: boolean
}

export function getExpiredVtxos(vtxos: Vtxo[], tipHeight: number): Vtxo[] {
  return vtxos.filter((vtxo) => vtxo.state.type === 'spendable' && vtxo.expiryHeight <= tipHeight)
}

// Asks the server about the expired coins; a spent one is marked spent locally,
// so it leaves the balance and coin selection. The call may be missing on a
// stock barkd or older bindings; that only turns the check off, it never blocks
// auto-refresh.
async function checkExpiredVtxos(expired: Vtxo[], queryClient: QueryClient): Promise<boolean> {
  if (expired.length > 0) {
    try {
      const statuses = await walletApi.adoptServerVtxoStatus({
        vtxos: expired.map((vtxo) => vtxo.id)
      })
      if (statuses.some((status) => status.state === 'spent')) {
        await invalidateMovementState(queryClient)
      }
    } catch {
      // Unsupported or unreachable: the coins stay Renewing.
    }
  }
  return true
}

export function useExpiredVtxos(): ExpiredVtxos {
  const queryClient = useQueryClient()
  const { data: tip } = useBitcoinTip()
  const { data: vtxos } = useVtxos()

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

  return { isChecked }
}
