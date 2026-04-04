import { type SendRequest, type SendResponse, WalletApi } from '@secondts/barkd'
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient
} from '@tanstack/react-query'
import { config } from '@/config/barkd'

const walletApi = new WalletApi(config)

export function useSend(
  options?: Omit<
    UseMutationOptions<SendResponse, Error, SendRequest>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: SendRequest) =>
      walletApi.send(params).then((response) => response.data),
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
