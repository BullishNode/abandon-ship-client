import { WalletApi } from '@secondts/barkd'
import type { Balance } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const walletApi = new WalletApi(config)

export function useWalletBalance(options?: Omit<UseQueryOptions<Balance>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryFn: async () => walletApi.balance(),
    queryKey: ['wallet', 'balance'],
    refetchInterval: 10_000,
    ...options
  })
}
