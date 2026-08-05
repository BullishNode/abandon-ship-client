import type { ArkInfo } from '@/types/domain/ark'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

const ONE_HOUR_MS = 60 * 60 * 1000

export function useArkInfo(options?: Omit<UseQueryOptions<ArkInfo>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryFn: async () => {
      const arkInfo = await walletApi.arkInfo()
      return arkInfo
    },
    queryKey: walletKeys.arkInfo(),
    staleTime: ONE_HOUR_MS,
    ...options
  })
}
