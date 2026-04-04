import { type Balance, WalletApi } from '@secondts/barkd'
import { type UseQueryOptions, useQuery } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const walletApi = new WalletApi(config)

export function useWalletBalance(
  options?: Omit<UseQueryOptions<Balance, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: () => walletApi.balance().then((response) => response.data),
    refetchInterval: 10_000,
    ...options
  })
}
