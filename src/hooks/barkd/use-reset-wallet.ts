import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { resetWalletQueriesAfterDelete } from '@/lib/query-invalidations'
import { useWalletStore } from '@/stores/wallet'

async function resetWallet() {
  const existsResponse = await walletApi.walletExists()
  if (!existsResponse.fingerprint) {
    throw new Error('No wallet to delete')
  }
  await walletApi.walletDelete({
    walletDeleteRequest: { dangerous: true, fingerprint: existsResponse.fingerprint }
  })
  useWalletStore.getState().clearWallet()
}

export function useResetWallet(
  options?: Omit<UseMutationOptions<void, Error, void>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resetWallet,
    ...options,
    onSuccess: async (...args) => {
      await resetWalletQueriesAfterDelete(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
