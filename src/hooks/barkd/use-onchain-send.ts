import { OnchainApi } from '@secondts/barkd'
import type { OnchainSendRequest, Send } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { invalidateOnchainState } from '@/lib/query-invalidations'

const onchainApi = new OnchainApi(config)

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
      await invalidateOnchainState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
