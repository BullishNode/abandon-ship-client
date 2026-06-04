import { useQuery } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

export function useWalletMnemonic(enabled: boolean) {
  return useQuery({
    enabled,
    gcTime: 0,
    queryFn: async () => {
      const { mnemonic } = await walletApi.mnemonic()
      return mnemonic
    },
    queryKey: walletKeys.mnemonic(),
    staleTime: Number.POSITIVE_INFINITY
  })
}
