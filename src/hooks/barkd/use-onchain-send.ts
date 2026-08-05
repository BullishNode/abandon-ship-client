import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { onchainApi } from '@/lib/barkd-client'
import { invalidateOnchainState } from '@/lib/query-invalidations'
import type { OnchainSendParams, OnchainSendResult } from '@/types/domain/wallet'

export function useOnchainSend(
  options?: Omit<UseMutationOptions<OnchainSendResult, Error, OnchainSendParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: OnchainSendParams) => {
      const response = await onchainApi.onchainSend(params)
      return response
    },
    ...options,
    onSuccess: async (...args) => {
      await options?.onSuccess?.(...args)
      await invalidateOnchainState(queryClient)
    }
  })
}
