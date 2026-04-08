import { type ArkAddressResponse, WalletApi } from '@secondts/barkd'
import { type UseMutationOptions, useMutation } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const walletApi = new WalletApi(config)

export function useWalletAddress(
  options?: Omit<
    UseMutationOptions<ArkAddressResponse['address'], Error>,
    'mutationFn'
  >
) {
  return useMutation({
    mutationFn: () => walletApi.address().then((response) => response.address),
    ...options
  })
}
