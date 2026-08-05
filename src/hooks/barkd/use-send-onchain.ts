import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { invalidateOffboardState } from '@/lib/query-invalidations'
import type { OffboardResult, OnchainSendParams } from '@/types/domain/wallet'

export function useSendOnchain(
  options?: Omit<UseMutationOptions<OffboardResult, Error, OnchainSendParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: OnchainSendParams) => {
      const response = await walletApi.sendOnchain(params)
      return response
    },
    ...options,
    onSuccess: async (...args) => {
      await options?.onSuccess?.(...args)
      await invalidateOffboardState(queryClient)
    }
  })
}
