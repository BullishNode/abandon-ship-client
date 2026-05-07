import type { OnchainFeeRatesResponse } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { feesApi } from '@/lib/barkd-client'
import { feeKeys } from '@/lib/query-keys'

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
