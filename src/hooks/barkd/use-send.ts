import { WalletApi } from '@secondts/barkd'
import type { SendRequest, SendResponse } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const walletApi = new WalletApi(config)

export function useSend(
  options?: Omit<UseMutationOptions<SendResponse, Error, SendRequest>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: SendRequest) => walletApi.send({ sendRequest: params }),
    ...options,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] })
      await queryClient.invalidateQueries({
        queryKey: ['wallet', 'transactions']
      })
      options?.onSuccess?.(...args)
    }
  })
}
