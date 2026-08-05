import type { PendingRound } from '@/types/domain/round'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { invalidateRefreshState } from '@/lib/query-invalidations'

export function useRefreshAll(options?: Omit<UseMutationOptions<PendingRound>, 'mutationFn'>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => await walletApi.refreshAll(),
    ...options,
    onSuccess: (...args) => {
      void invalidateRefreshState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
