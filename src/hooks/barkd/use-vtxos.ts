import type { Vtxo } from '@/types/domain/vtxo'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

interface UseVtxosParams {
  all?: boolean
}

export function useVtxos(
  params?: UseVtxosParams,
  options?: Omit<UseQueryOptions<Vtxo[]>, 'queryKey' | 'queryFn'>
) {
  const all = params?.all ?? false
  return useQuery({
    queryFn: async () => await walletApi.vtxos({ all }),
    queryKey: all ? walletKeys.vtxosAll() : walletKeys.vtxos(),
    refetchInterval: 30_000,
    ...options
  })
}
