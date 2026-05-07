import { OnchainApi } from '@secondts/barkd'
import type { TransactionInfo } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { onchainKeys } from '@/lib/query-keys'

const onchainApi = new OnchainApi(config)

export function useOnchainTransactions(
  options?: Omit<UseQueryOptions<TransactionInfo[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => {
      const transactions = await onchainApi.onchainTransactions()
      return transactions
    },
    queryKey: onchainKeys.transactions(),
    ...options
  })
}
