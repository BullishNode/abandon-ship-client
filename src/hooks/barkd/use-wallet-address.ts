import { useMutation } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'

export function useWalletAddress(options?: Omit<UseMutationOptions<string>, 'mutationFn'>) {
  return useMutation({
    mutationFn: async () => await walletApi.address(),
    ...options
  })
}
