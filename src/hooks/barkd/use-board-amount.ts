import type { PendingBoardInfo } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { boardsApi } from '@/lib/barkd-client'
import { invalidateBoardState } from '@/lib/query-invalidations'

interface BoardAmountInput {
  amountSat: number
}

export function useBoardAmount(
  options?: Omit<UseMutationOptions<PendingBoardInfo, Error, BoardAmountInput>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ amountSat }: BoardAmountInput) =>
      await boardsApi.boardAmount({ boardRequest: { amountSat } }),
    ...options,
    onSuccess: async (...args) => {
      await invalidateBoardState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
