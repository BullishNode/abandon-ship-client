import { type FeeEstimateResponse, FeesApi } from '@secondts/barkd'
import { type UseQueryOptions, useQuery } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const feesApi = new FeesApi(config)

export function useLightningSendFee(
  amountSat: number | undefined,
  options?: Omit<
    UseQueryOptions<FeeEstimateResponse, Error>,
    'queryKey' | 'queryFn' | 'enabled'
  >
) {
  return useQuery({
    queryKey: ['fees', 'lightning', 'send', amountSat],
    queryFn: () => {
      if (amountSat === undefined) {
        throw new Error('amountSat is required')
      }
      return feesApi.lightningSendFee({ amountSat })
    },
    enabled: amountSat !== undefined && amountSat > 0,
    ...options
  })
}
