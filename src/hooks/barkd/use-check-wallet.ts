import { WalletApi } from '@secondts/barkd'
import { type UseQueryOptions, useQuery } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const walletApi = new WalletApi(config)

async function checkWallet() {
  const response = await walletApi.walletExists()
  return response.data.fingerprint != null
}

export function useCheckWallet(
  options?: Omit<UseQueryOptions<boolean, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['wallet', 'exists'],
    queryFn: checkWallet,
    retry: false,
    ...options
  })
}
