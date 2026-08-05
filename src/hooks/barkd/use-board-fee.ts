import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { feesApi } from '@/lib/barkd-client'
import { feeKeys } from '@/lib/query-keys'
import type { FeeEstimate } from '@/types/domain/fees'

export function useBoardFee(
  amountSat: number | undefined,
  options?: Omit<UseQueryOptions<FeeEstimate>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    enabled: amountSat !== undefined && amountSat > 0,
    queryFn: async () => {
      if (amountSat === undefined) {
        throw new Error('amountSat is required')
      }
      const fee = await feesApi.boardFee({ amountSats: amountSat })
      return fee
    },
    queryKey: feeKeys.board(amountSat),
    staleTime: 30_000,
    ...options
  })
}
