import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { walletApi } from '@/lib/barkd-client'
import { invalidateMovementState } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import type { Vtxo } from '@/types/domain/vtxo'

export interface ExpiredVtxos {
  // 'pending' until the first check of the current expired coins answers;
  // auto-refresh waits for it so it never submits a paid-out coin. 'failed'
  // when the last check could not settle them; auto-refresh then leaves the
  // expired coins out but still refreshes the others.
  status: 'pending' | 'checked' | 'failed'
}

export function getExpiredVtxos(vtxos: Vtxo[], tipHeight: number): Vtxo[] {
  return vtxos.filter((vtxo) => vtxo.state.type === 'spendable' && vtxo.expiryHeight <= tipHeight)
}

// A stock barkd has no such route and the WASM backend no such call; neither
// can ever answer, so that only turns the check off.
async function isCallUnsupported(error: unknown): Promise<boolean> {
  if (__BACKEND__ === 'wasm') {
    return true
  }
  const { isRouteNotFoundError } = await import('@/lib/backend/barkd/errors')
  return isRouteNotFoundError(error)
}

// Asks the server about the expired coins; a spent one is marked spent locally,
// so it leaves the balance and coin selection once the coin list reloads.
// Resolves false when the request or that reload fails, so the coins stay
// unchecked until the next interval.
async function checkExpiredVtxos(expired: Vtxo[], queryClient: QueryClient): Promise<boolean> {
  if (expired.length === 0) {
    return true
  }
  try {
    const statuses = await walletApi.adoptServerVtxoStatus({
      vtxos: expired.map((vtxo) => vtxo.id)
    })
    if (statuses.some((status) => status.state === 'spent')) {
      // Invalidation swallows refetch errors, so the coin list's state tells
      // whether the spent coin really left it.
      await invalidateMovementState(queryClient)
      return queryClient.getQueryState(walletKeys.vtxos())?.status !== 'error'
    }
    return true
  } catch (error) {
    return await isCallUnsupported(error)
  }
}

export function useExpiredVtxos(): ExpiredVtxos {
  const queryClient = useQueryClient()
  const { data: tip } = useBitcoinTip()
  const { data: vtxos } = useVtxos()

  const expired = tip === undefined ? [] : getExpiredVtxos(vtxos ?? [], tip)
  const { data: isChecked } = useQuery({
    enabled: tip !== undefined && vtxos !== undefined,
    queryFn: async () => await checkExpiredVtxos(expired, queryClient),
    queryKey: walletKeys.expiredVtxos(
      tip,
      expired.map((vtxo) => vtxo.id)
    ),
    refetchInterval: 30_000,
    staleTime: Number.POSITIVE_INFINITY
  })

  if (isChecked === undefined) {
    return { status: 'pending' }
  }
  return { status: isChecked ? 'checked' : 'failed' }
}
