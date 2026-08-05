import type { ExitTransactionStatus } from '@/types/domain/exit'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { exitsApi } from '@/lib/barkd-client'
import { exitKeys } from '@/lib/query-keys'
import { summarizeExits } from '@/utils/exit-progress'

const EXIT_STATUS_POLL_MS = 10_000

export function useExitStatus(
  options?: Omit<UseQueryOptions<ExitTransactionStatus[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => await exitsApi.getAllExitStatus(),
    queryKey: exitKeys.status(),
    refetchInterval: (query) => {
      const exits = query.state.data
      if (!exits || exits.length === 0) {
        return false
      }
      return summarizeExits(exits).isDone ? false : EXIT_STATUS_POLL_MS
    },
    ...options
  })
}
