import type { PendingRoundInfo } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { invalidateRefreshState } from '@/lib/query-invalidations'

interface RefreshVtxosParams {
  vtxos: string[]
}

export function useRefreshVtxos(
  options?: Omit<UseMutationOptions<PendingRoundInfo, Error, RefreshVtxosParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ vtxos }: RefreshVtxosParams) =>
      await walletApi.refreshVtxos({ refreshRequest: { vtxos } }),
    ...options,
    onSuccess: async (...args) => {
      await invalidateRefreshState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
