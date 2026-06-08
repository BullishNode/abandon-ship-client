import type { PendingRoundInfo } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { invalidateRefreshState } from '@/lib/query-invalidations'

export function useRefreshCounterparty(
  options?: Omit<UseMutationOptions<PendingRoundInfo>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => await walletApi.refreshCounterparty(),
    ...options,
    onSuccess: async (...args) => {
      await invalidateRefreshState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
