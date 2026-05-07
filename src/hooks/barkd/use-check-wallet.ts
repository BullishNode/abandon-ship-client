import { WalletApi } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { walletKeys } from '@/lib/query-keys'

const walletApi = new WalletApi(config)

async function checkWallet() {
  const response = await walletApi.walletExists()
  return response.fingerprint !== null && response.fingerprint !== undefined
}

export function useCheckWallet(options?: Omit<UseQueryOptions<boolean>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryFn: checkWallet,
    queryKey: walletKeys.exists(),
    retry: false,
    ...options
  })
}
