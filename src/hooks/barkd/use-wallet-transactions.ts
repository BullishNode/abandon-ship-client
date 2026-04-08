import { type Movement, WalletApi } from '@secondts/barkd'
import { type UseQueryOptions, useQuery } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const walletApi = new WalletApi(config)

export function useWalletTransactions(
  options?: Omit<UseQueryOptions<Movement[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['wallet', 'transactions'],
    queryFn: () => walletApi.history(),
    ...options
  })
}
