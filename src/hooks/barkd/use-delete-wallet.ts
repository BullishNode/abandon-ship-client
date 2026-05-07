import { WalletApi } from '@secondts/barkd'
import type { WalletDeleteRequest } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { invalidateWalletExistence } from '@/lib/query-invalidations'
import { useWalletStore } from '@/stores/wallet'

const walletApi = new WalletApi(config)

async function deleteWallet(params: WalletDeleteRequest) {
  const response = await walletApi.walletDelete({
    walletDeleteRequest: params
  })

  if (response.deleted) {
    useWalletStore.getState().clearWallet()
  }

  return response
}

export function useDeleteWallet(
  options?: Omit<
    UseMutationOptions<{ deleted: boolean; message: string }, Error, WalletDeleteRequest>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteWallet,
    ...options,
    onSuccess: async (...args) => {
      await invalidateWalletExistence(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
