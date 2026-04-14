import { WalletApi } from '@secondts/barkd'
import type { ArkAddressResponse } from '@secondts/barkd'
import { useMutation } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const walletApi = new WalletApi(config)

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
