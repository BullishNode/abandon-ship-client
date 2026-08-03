import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

export function useVtxoEncoded(
  id: string,
  options?: Omit<UseQueryOptions<string>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => {
      const response = await walletApi.getVtxoEncoded({ id })
      return response.encoded
    },
    queryKey: walletKeys.vtxoEncoded(id),
    staleTime: Number.POSITIVE_INFINITY,
    ...options
  })
}
