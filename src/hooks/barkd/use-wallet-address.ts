import { type Address, WalletApi } from '@secondts/barkd'
import { type UseMutationOptions, useMutation } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const walletApi = new WalletApi(config)

export function useWalletAddress(
  options?: Omit<UseMutationOptions<Address['address'], Error>, 'mutationFn'>
) {
  return useMutation({
    mutationFn: () =>
      walletApi.address().then((response) => response.data.address),
    ...options
  })
}
