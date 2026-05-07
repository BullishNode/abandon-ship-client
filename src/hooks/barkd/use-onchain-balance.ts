import type { OnchainBalance } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { onchainApi } from '@/lib/barkd-client'
import { onchainKeys } from '@/lib/query-keys'

export function useOnchainBalance(
  options?: Omit<UseQueryOptions<OnchainBalance>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => {
      const balance = await onchainApi.onchainBalance()
      return balance
    },
    queryKey: onchainKeys.balance(),
    refetchInterval: 30_000,
    ...options
  })
}
