import type { ExitClaimResponse } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { exitsApi } from '@/lib/barkd-client'
import { invalidateExitState } from '@/lib/query-invalidations'

interface ClaimEmergencyExitParams {
  destination: string
}

export function useClaimEmergencyExit(
  options?: Omit<
    UseMutationOptions<ExitClaimResponse, Error, ClaimEmergencyExitParams>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ destination }: ClaimEmergencyExitParams) =>
      await exitsApi.exitClaimAll({
        exitClaimAllRequest: { destination }
      }),
    ...options,
    onSuccess: async (...args) => {
      await invalidateExitState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
