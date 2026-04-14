import { FeesApi } from '@secondts/barkd'
import type { FeeEstimateResponse } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const feesApi = new FeesApi(config)

export function useLightningSendFee(
  amountSat: number | undefined,
  options?: Omit<UseQueryOptions<FeeEstimateResponse>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    enabled: amountSat !== undefined && amountSat > 0,
    queryFn: async () => {
      if (amountSat === undefined) {
        throw new Error('amountSat is required')
      }
      return feesApi.lightningSendFee({ amountSat })
    },
    queryKey: ['fees', 'lightning', 'send', amountSat],
    ...options
  })
}
