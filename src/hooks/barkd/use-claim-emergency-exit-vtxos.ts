import type { ExitClaimResponse } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { exitsApi } from '@/lib/barkd-client'
import { invalidateExitState } from '@/lib/query-invalidations'

interface ClaimEmergencyExitVtxosParams {
  destination: string
  vtxos: string[]
}

export function useClaimEmergencyExitVtxos(
  options?: Omit<
    UseMutationOptions<ExitClaimResponse, Error, ClaimEmergencyExitVtxosParams>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ destination, vtxos }: ClaimEmergencyExitVtxosParams) =>
      await exitsApi.exitClaimVtxos({ exitClaimVtxosRequest: { destination, vtxos } }),
    ...options,
    onSuccess: async (...args) => {
      await invalidateExitState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
