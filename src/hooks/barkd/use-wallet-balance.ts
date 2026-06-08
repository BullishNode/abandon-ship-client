import type { Balance } from '@secondts/barkd'
import { replaceEqualDeep, useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'
import { carryForwardPendingExit } from '@/utils/balance'

export function useWalletBalance(options?: Omit<UseQueryOptions<Balance>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryFn: async () => {
      const balance = await walletApi.balance()
      return balance
    },
    queryKey: walletKeys.balance(),
    refetchInterval: 10_000,
    structuralSharing: (previous, next) =>
      replaceEqualDeep(previous, carryForwardPendingExit(previous, next)),
    ...options
  })
}
