import { useQuery } from '@tanstack/react-query'
import { getWalletMnemonic } from '@/lib/bark-web-api-client'
import { walletKeys } from '@/lib/query-keys'

export function useWalletMnemonic(enabled: boolean) {
  return useQuery({
    enabled,
    gcTime: 0,
    queryFn: getWalletMnemonic,
    queryKey: walletKeys.mnemonic(),
    staleTime: Number.POSITIVE_INFINITY
  })
}
