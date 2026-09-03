import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { exitsApi } from '@/lib/barkd-client'
import { feeKeys } from '@/lib/query-keys'
import type { EmergencyExitFeeEstimate } from '@/types/domain/fees'

export function useEmergencyExitFee(
  vtxos: string[],
  destination: string | undefined,
  options?: Omit<UseQueryOptions<EmergencyExitFeeEstimate>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async () => await exitsApi.emergencyExitFee({ destination, vtxos }),
    queryKey: feeKeys.emergencyExit(vtxos, destination),
    staleTime: 30_000,
    ...options,
    enabled: vtxos.length > 0 && (options?.enabled ?? true)
  })
}
