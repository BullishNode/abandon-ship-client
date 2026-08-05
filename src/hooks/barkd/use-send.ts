import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { invalidateMovementState } from '@/lib/query-invalidations'
import type { SendParams, SendResult } from '@/types/domain/wallet'

export function useSend(
  options?: Omit<UseMutationOptions<SendResult, Error, SendParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: SendParams) => {
      const response = await walletApi.send(params)
      return response
    },
    ...options,
    onSuccess: async (...args) => {
      await options?.onSuccess?.(...args)
      await invalidateMovementState(queryClient)
    }
  })
}
