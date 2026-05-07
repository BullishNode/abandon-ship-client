import { FeesApi } from '@secondts/barkd'
import type { FeeEstimateResponse } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { feeKeys } from '@/lib/query-keys'

const feesApi = new FeesApi(config)

export function useSendOnchainFee(
  amountSat: number | undefined,
  address: string | undefined,
  options?: Omit<UseQueryOptions<FeeEstimateResponse>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    enabled: amountSat !== undefined && amountSat > 0 && address !== undefined && address !== '',
    queryFn: async () => {
      if (amountSat === undefined || address === undefined) {
        throw new Error('amountSat and address are required')
      }
      const fee = await feesApi.sendOnchainFee({ address, amountSat })
      return fee
    },
    queryKey: feeKeys.onchainSend(amountSat, address),
    ...options
  })
}
