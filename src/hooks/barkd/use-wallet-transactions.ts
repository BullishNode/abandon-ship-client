import { WalletApi } from '@secondts/barkd'
import type { Movement } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { walletKeys } from '@/lib/query-keys'

const walletApi = new WalletApi(config)

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
