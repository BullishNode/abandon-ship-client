import type { WalletTxInfo } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { onchainApi } from '@/lib/barkd-client'
import { onchainKeys } from '@/lib/query-keys'

export function useOnchainTransactions(
  options?: Omit<UseQueryOptions<WalletTxInfo[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => {
      const transactions = await onchainApi.onchainTransactions()
      return transactions
    },
    queryKey: onchainKeys.transactions(),
    refetchInterval: 30_000,
    ...options
  })
}
