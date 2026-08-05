import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { resetWalletQueriesAfterDelete } from '@/lib/query-invalidations'
import { useWalletStore } from '@/stores/wallet'
import type { DeleteWalletParams, DeleteWalletResult } from '@/types/domain/wallet'

async function deleteWallet(params: DeleteWalletParams): Promise<DeleteWalletResult> {
  const response = await walletApi.walletDelete(params)
  if (response.deleted) {
    useWalletStore.getState().clearWallet()
  }
  return response
}

export function useDeleteWallet(
  options?: Omit<UseMutationOptions<DeleteWalletResult, Error, DeleteWalletParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteWallet,
    ...options,
    onSuccess: async (...args) => {
      // Full post-delete reset: invalidating existence alone would leave the
      // infinite-staleTime autoCreate query cached as "done", so the root page
      // would never create a wallet again after a delete.
      await resetWalletQueriesAfterDelete(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
