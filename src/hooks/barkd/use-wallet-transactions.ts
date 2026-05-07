import type { Movement } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

export function useWalletTransactions(
  options?: Omit<UseQueryOptions<Movement[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => {
      const transactions = await walletApi.history()
      return transactions.filter((m) => m.subsystem.kind !== 'refresh')
    },
    queryKey: walletKeys.transactions(),
    ...options
  })
}
