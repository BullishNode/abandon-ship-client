import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { boardsApi } from '@/lib/barkd-client'
import { invalidateBoardState } from '@/lib/query-invalidations'
import type { PendingBoard } from '@/types/domain/board'

interface BoardAmountInput {
  amountSat: number
}

export function useBoardAmount(
  options?: Omit<UseMutationOptions<PendingBoard, Error, BoardAmountInput>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ amountSat }: BoardAmountInput) =>
      await boardsApi.boardAmount({ amountSats: amountSat }),
    ...options,
    onSuccess: async (...args) => {
      await invalidateBoardState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
