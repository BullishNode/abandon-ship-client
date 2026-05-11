import type { ExitTransactionStatus } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { exitsApi } from '@/lib/barkd-client'
import { exitKeys } from '@/lib/query-keys'

export function useExitStatus(
  options?: Omit<UseQueryOptions<ExitTransactionStatus[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => await exitsApi.getAllExitStatus({}),
    queryKey: exitKeys.status(),
    refetchInterval: 10_000,
    ...options
  })
}
