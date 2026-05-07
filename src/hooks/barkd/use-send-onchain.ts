import { WalletApi } from '@secondts/barkd'
import type { OffboardResult, SendOnchainRequest } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { invalidateWalletState } from '@/lib/query-invalidations'

const walletApi = new WalletApi(config)

export function useSendOnchain(
  options?: Omit<UseMutationOptions<OffboardResult, Error, SendOnchainRequest>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: SendOnchainRequest) => {
      const response = await walletApi.sendOnchain({ sendOnchainRequest: params })
      return response
    },
    ...options,
    onSuccess: async (...args) => {
      await invalidateWalletState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
