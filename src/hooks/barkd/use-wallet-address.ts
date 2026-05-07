import type { ArkAddressResponse } from '@secondts/barkd'
import { useMutation } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'

export function useWalletAddress(
  options?: Omit<UseMutationOptions<ArkAddressResponse['address']>, 'mutationFn'>
) {
  return useMutation({
    mutationFn: async () => {
      const response = await walletApi.address()
      return response.address
    },
    ...options
  })
}
