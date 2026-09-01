import type { PendingRound } from '@/types/domain/round'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'
import { isRoundInProgress } from '@/utils/refresh'

const ACTIVE_POLL_MS = 10_000
const IDLE_POLL_MS = 30_000

export function usePendingRounds(
  options?: Omit<UseQueryOptions<PendingRound[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => await walletApi.pendingRounds(),
    queryKey: walletKeys.pendingRounds(),
    // Never `false`: an empty list is exactly the state a just-submitted round
    // starts in, and stopping there left polling permanently dead.
    refetchInterval: (query) =>
      isRoundInProgress(query.state.data) ? ACTIVE_POLL_MS : IDLE_POLL_MS,
    ...options
  })
}
