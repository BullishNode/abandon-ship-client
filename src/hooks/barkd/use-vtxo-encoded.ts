import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

export function useVtxoEncoded(
  id: string,
  options?: Omit<UseQueryOptions<string>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => await walletApi.vtxoEncoded(id),
    queryKey: walletKeys.vtxoEncoded(id),
    staleTime: Number.POSITIVE_INFINITY,
    ...options
  })
}
