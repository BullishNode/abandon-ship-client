import type { FeeEstimate } from '@/types/domain/fees'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { feesApi } from '@/lib/barkd-client'
import { feeKeys } from '@/lib/query-keys'

export function useSendOnchainFee(
  amountSat: number | undefined,
  address: string | undefined,
  options?: Omit<UseQueryOptions<FeeEstimate>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    enabled: amountSat !== undefined && amountSat > 0 && address !== undefined && address !== '',
    queryFn: async () => {
      if (amountSat === undefined || address === undefined) {
        throw new Error('amountSat and address are required')
      }
      const fee = await feesApi.sendOnchainFee({ address, amountSats: amountSat })
      return fee
    },
    queryKey: feeKeys.onchainSend(amountSat, address),
    staleTime: 30_000,
    ...options
  })
}
