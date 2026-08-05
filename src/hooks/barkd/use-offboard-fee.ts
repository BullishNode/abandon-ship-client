import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { feesApi } from '@/lib/barkd-client'
import { feeKeys } from '@/lib/query-keys'
import type { FeeEstimate } from '@/types/domain/fees'

export function useOffboardFee(
  address: string | undefined,
  vtxos: string[],
  options?: Omit<UseQueryOptions<FeeEstimate>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    enabled: address !== undefined && address !== '' && vtxos.length > 0,
    queryFn: async () => {
      if (address === undefined) {
        throw new Error('address is required')
      }
      return await feesApi.offboardFee({ address, vtxos })
    },
    queryKey: feeKeys.offboard(address, vtxos),
    staleTime: 30_000,
    ...options
  })
}
