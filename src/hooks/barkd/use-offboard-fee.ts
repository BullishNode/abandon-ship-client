import type { FeeEstimateResponse } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { feesApi } from '@/lib/barkd-client'
import { feeKeys } from '@/lib/query-keys'

export function useOffboardFee(
  address: string | undefined,
  vtxos: string[],
  options?: Omit<UseQueryOptions<FeeEstimateResponse>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    enabled: address !== undefined && address !== '' && vtxos.length > 0,
    queryFn: async () => {
      if (address === undefined) {
        throw new Error('address is required')
      }
      const fee = await feesApi.offboardFee({ offboardFeeEstimateRequest: { address, vtxos } })
      return fee
    },
    queryKey: feeKeys.offboard(address, vtxos),
    staleTime: 30_000,
    ...options
  })
}
