import type { TipResponse } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { bitcoinApi } from '@/lib/barkd-client'
import { bitcoinKeys } from '@/lib/query-keys'

export function useBitcoinTip(
  options?: Omit<UseQueryOptions<TipResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => await bitcoinApi.tip(),
    queryKey: bitcoinKeys.tip(),
    refetchInterval: 60_000,
    ...options
  })
}
