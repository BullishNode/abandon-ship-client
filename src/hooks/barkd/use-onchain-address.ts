import { useMutation } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { onchainApi } from '@/lib/barkd-client'

export function useOnchainAddress(options?: Omit<UseMutationOptions<string>, 'mutationFn'>) {
  return useMutation({
    mutationFn: async () => await onchainApi.onchainAddress(),
    ...options
  })
}
