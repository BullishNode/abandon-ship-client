import { type Address, OnchainApi } from '@secondts/barkd'
import { type UseMutationOptions, useMutation } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const onchainApi = new OnchainApi(config)

export function useOnchainAddress(
  options?: Omit<UseMutationOptions<Address['address'], Error>, 'mutationFn'>
) {
  return useMutation({
    mutationFn: () =>
      onchainApi.onchainAddress().then((response) => response.data.address),
    ...options
  })
}
