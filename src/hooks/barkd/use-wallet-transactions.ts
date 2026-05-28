import type { Movement } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { historyApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

export function useWalletTransactions(
  options?: Omit<UseQueryOptions<Movement[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => await historyApi.list(),
    queryKey: walletKeys.transactions(),
    ...options
  })
}
