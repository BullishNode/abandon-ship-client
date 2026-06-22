import type { OffboardResult } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { invalidateOffboardState } from '@/lib/query-invalidations'

interface OffboardVtxosParams {
  vtxos: string[]
  address?: string
}

export function useOffboardVtxos(
  options?: Omit<UseMutationOptions<OffboardResult, Error, OffboardVtxosParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ vtxos, address }: OffboardVtxosParams) =>
      await walletApi.offboardVtxos({ offboardVtxosRequest: { address, vtxos } }),
    ...options,
    onSuccess: async (...args) => {
      await invalidateOffboardState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
