import type { FeeEstimateResponse } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { feesApi } from '@/lib/barkd-client'
import { feeKeys } from '@/lib/query-keys'

export function useLightningReceiveFee(
  amountSat: number | undefined,
  options?: Omit<UseQueryOptions<FeeEstimateResponse>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    enabled: amountSat !== undefined && amountSat > 0,
    queryFn: async () => {
      if (amountSat === undefined) {
        throw new Error('amountSat is required')
      }
      const fee = await feesApi.lightningReceiveFee({ amountSat })
      return fee
    },
    queryKey: feeKeys.lightningReceive(amountSat),
    ...options
  })
}
