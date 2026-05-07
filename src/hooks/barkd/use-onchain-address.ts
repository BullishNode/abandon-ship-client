import type { Address } from '@secondts/barkd'
import { useMutation } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { onchainApi } from '@/lib/barkd-client'

export function useOnchainAddress(
  options?: Omit<UseMutationOptions<Address['address']>, 'mutationFn'>
) {
  return useMutation({
    mutationFn: async () => {
      const response = await onchainApi.onchainAddress()
      return response.address
    },
    ...options
  })
}
