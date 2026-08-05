import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { invalidateOffboardState } from '@/lib/query-invalidations'
import { usePendingOffboardsStore } from '@/stores/pending-offboards'
import type { OffboardResult } from '@/types/domain/wallet'

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
      await walletApi.offboardVtxos({ address, vtxos }),
    ...options,
    onSuccess: (...args) => {
      const [{ offboardTxid }] = args
      if (offboardTxid !== null) {
        usePendingOffboardsStore.getState().add(offboardTxid, Date.now())
      }
      void invalidateOffboardState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
