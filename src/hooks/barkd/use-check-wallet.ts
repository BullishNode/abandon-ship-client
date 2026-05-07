import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

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
