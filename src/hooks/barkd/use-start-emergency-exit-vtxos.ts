import type { ExitStartResult } from '@/types/domain/exit'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { exitsApi } from '@/lib/barkd-client'
import { invalidateExitState } from '@/lib/query-invalidations'

export function useStartEmergencyExitVtxos(
  options?: Omit<UseMutationOptions<ExitStartResult, Error, string[]>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vtxos: string[]) => await exitsApi.exitStartVtxos({ vtxos }),
    ...options,
    onSuccess: async (...args) => {
      await invalidateExitState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
