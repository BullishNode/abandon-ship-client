import type { RefreshingVtxo } from '@/types/domain/round'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

const ACTIVE_POLL_MS = 10_000
const IDLE_POLL_MS = 30_000

export function useRefreshingVtxos(
  options?: Omit<UseQueryOptions<RefreshingVtxo[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => await walletApi.refreshingVtxos(),
    queryKey: walletKeys.refreshingVtxos(),
    refetchInterval: (query) =>
      (query.state.data?.length ?? 0) > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS,
    ...options
  })
}
