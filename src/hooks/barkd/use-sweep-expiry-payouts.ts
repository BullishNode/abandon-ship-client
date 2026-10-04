import type { ExpiryPayoutSweep } from '@/types/domain/expiry-payout'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { onchainApi } from '@/lib/barkd-client'
import { invalidateMovementState } from '@/lib/query-invalidations'
import { walletKeys } from '@/lib/query-keys'

export function useSweepExpiryPayouts(
  options?: Omit<UseMutationOptions<ExpiryPayoutSweep>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => await onchainApi.sweepExpiryPayouts(),
    ...options,
    onSuccess: async (...args) => {
      // The sweep spent the payout outputs. Clear them before balance refetches,
      // including when the next payout lookup fails, so they cannot count twice.
      await queryClient.cancelQueries({ queryKey: walletKeys.expiryPayouts() })
      queryClient.setQueryData(walletKeys.expiryPayouts(), [])
      await Promise.all([
        invalidateMovementState(queryClient),
        queryClient.invalidateQueries({ queryKey: walletKeys.expiredVtxosAll() })
      ])
      options?.onSuccess?.(...args)
    }
  })
}
