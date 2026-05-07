import { FeesApi } from '@secondts/barkd'
import type { OnchainFeeRatesResponse } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { feeKeys } from '@/lib/query-keys'

const feesApi = new FeesApi(config)

export function useOnchainFeeRates(
  options?: Omit<UseQueryOptions<OnchainFeeRatesResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => {
      const rates = await feesApi.onchainFeeRates()
      return rates
    },
    queryKey: feeKeys.onchainRates(),
    refetchInterval: 60_000,
    ...options
  })
}
