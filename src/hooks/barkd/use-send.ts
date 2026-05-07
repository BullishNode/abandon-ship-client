import { WalletApi } from '@secondts/barkd'
import type { SendRequest, SendResponse } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { invalidateWalletState } from '@/lib/query-invalidations'

const walletApi = new WalletApi(config)

export function useSend(
  options?: Omit<UseMutationOptions<SendResponse, Error, SendRequest>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: SendRequest) => {
      const response = await walletApi.send({ sendRequest: params })
      return response
    },
    ...options,
    onSuccess: async (...args) => {
      await invalidateWalletState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
