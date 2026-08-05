import type { PendingRound } from '@/types/domain/round'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

const PENDING_ROUNDS_POLL_MS = 10_000

export function usePendingRounds(
  options?: Omit<UseQueryOptions<PendingRound[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => await walletApi.pendingRounds(),
    queryKey: walletKeys.pendingRounds(),
    refetchInterval: (query) => {
      const rounds = query.state.data
      return rounds && rounds.length > 0 ? PENDING_ROUNDS_POLL_MS : false
    },
    ...options
  })
}
