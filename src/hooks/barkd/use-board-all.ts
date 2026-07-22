import type { PendingBoardInfo } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { boardsApi } from '@/lib/barkd-client'
import { invalidateBoardState } from '@/lib/query-invalidations'

export function useBoardAll(options?: Omit<UseMutationOptions<PendingBoardInfo>, 'mutationFn'>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => await boardsApi.boardAll(),
    ...options,
    onSuccess: async (...args) => {
      await invalidateBoardState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
