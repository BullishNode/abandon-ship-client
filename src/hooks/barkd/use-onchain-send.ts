import type { OnchainSendRequest, Send } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { onchainApi } from '@/lib/barkd-client'
import { invalidateOnchainState } from '@/lib/query-invalidations'

export function useOnchainSend(
  options?: Omit<UseMutationOptions<Send, Error, OnchainSendRequest>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: OnchainSendRequest) => {
      const response = await onchainApi.onchainSend({ onchainSendRequest: params })
      return response
    },
    ...options,
    onSuccess: async (...args) => {
      await options?.onSuccess?.(...args)
      await invalidateOnchainState(queryClient)
    }
  })
}
