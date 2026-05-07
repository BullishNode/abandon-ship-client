import type { NextRoundStart } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'

export function useNextRound(
  options?: Omit<UseQueryOptions<NextRoundStart>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => {
      const nextRound = await walletApi.nextRound()
      return nextRound
    },
    queryKey: walletKeys.nextRound(),
    refetchInterval: 30_000,
    ...options
  })
}
