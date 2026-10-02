import type { ExpiryPayoutSweep } from '@/types/domain/expiry-payout'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { onchainApi } from '@/lib/barkd-client'
import { invalidateMovementState } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'
import { useWalletStore } from '@/stores/wallet'

interface SweepParams {
  // The coins whose payouts this sweep spends: they stop being "paying out".
  vtxoIds: string[]
}

export function useSweepExpiryPayouts(
  options?: Omit<UseMutationOptions<ExpiryPayoutSweep, Error, SweepParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient()
  const removePayingOutVtxos = useWalletStore((state) => state.removePayingOutVtxos)

  return useMutation({
    mutationFn: async (_params: SweepParams) => await onchainApi.sweepExpiryPayouts(),
    ...options,
    onSuccess: async (...args) => {
      removePayingOutVtxos(args[1].vtxoIds)
      await Promise.all([
        invalidateMovementState(queryClient),
        queryClient.invalidateQueries({ queryKey: walletKeys.expiredVtxosAll() })
      ])
      options?.onSuccess?.(...args)
    }
  })
}
