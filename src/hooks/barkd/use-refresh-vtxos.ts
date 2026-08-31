import type { PendingRound } from '@/types/domain/round'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { invalidateRefreshState } from '@/lib/query-invalidations'

interface RefreshVtxosParams {
  vtxos: string[]
}

export function useRefreshVtxos(
  options?: Omit<UseMutationOptions<PendingRound | null, Error, RefreshVtxosParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ vtxos }: RefreshVtxosParams) => await walletApi.refreshVtxos({ vtxos }),
    ...options,
    onSuccess: (...args) => {
      void invalidateRefreshState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
