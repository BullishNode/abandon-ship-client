import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { exitsApi } from '@/lib/barkd-client'
import { invalidateExitState } from '@/lib/query-invalidations'
import { useWalletStore } from '@/stores/wallet'
import type { ExitClaimResult } from '@/types/domain/exit'

interface ClaimEmergencyExitVtxosParams {
  destination: string
  vtxos: string[]
}

export function useClaimEmergencyExitVtxos(
  options?: Omit<
    UseMutationOptions<ExitClaimResult, Error, ClaimEmergencyExitVtxosParams>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient()
  const clearExitClaimAddresses = useWalletStore((state) => state.clearExitClaimAddresses)

  return useMutation({
    mutationFn: async ({ destination, vtxos }: ClaimEmergencyExitVtxosParams) =>
      await exitsApi.exitClaimVtxos({ destination, vtxos }),
    ...options,
    onSuccess: async (...args) => {
      const [, variables] = args
      clearExitClaimAddresses(variables.vtxos)
      await invalidateExitState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
