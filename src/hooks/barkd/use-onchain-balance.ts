import { OnchainApi } from '@secondts/barkd'
import type { OnchainBalance } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { onchainKeys } from '@/lib/query-keys'

const onchainApi = new OnchainApi(config)

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
