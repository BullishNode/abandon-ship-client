import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { boardsApi } from '@/lib/barkd-client'
import { invalidateBoardState } from '@/lib/query-invalidations'
import type { PendingBoard } from '@/types/domain/board'

export function useBoardAll(options?: Omit<UseMutationOptions<PendingBoard>, 'mutationFn'>) {
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
