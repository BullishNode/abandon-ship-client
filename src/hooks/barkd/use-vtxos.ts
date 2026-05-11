import type { WalletVtxoInfo } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

export function useVtxos(
  options?: Omit<UseQueryOptions<WalletVtxoInfo[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => await walletApi.vtxos({}),
    queryKey: walletKeys.vtxos(),
    refetchInterval: 30_000,
    ...options
  })
}
