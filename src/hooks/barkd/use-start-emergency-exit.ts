import type { ExitStartResult } from '@/types/domain/exit'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { exitsApi } from '@/lib/barkd-client'
import { invalidateExitState } from '@/lib/query-invalidations'

export function useStartEmergencyExit(
  options?: Omit<UseMutationOptions<ExitStartResult>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => await exitsApi.exitStartAll(),
    ...options,
    onSuccess: async (...args) => {
      await invalidateExitState(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
