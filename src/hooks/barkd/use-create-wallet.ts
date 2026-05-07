import { WalletApi } from '@secondts/barkd'
import type { CreateWalletRequest } from '@secondts/barkd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { invalidateWalletExistence } from '@/lib/query-invalidations'
import { useWalletStore } from '@/stores/wallet'

const walletApi = new WalletApi(config)
interface CreateWalletParams extends CreateWalletRequest {
  name: string
  mnemonic: string
  createdAt: Date
}

async function createWallet(params: CreateWalletParams) {
  const { setWallet } = useWalletStore.getState()

  const response = await walletApi.createWallet({
    createWalletRequest: {
      arkServer: params.arkServer,
      chainSource: params.chainSource,
      mnemonic: params.mnemonic,
      network: params.network
    }
  })
  const { fingerprint } = response

  if (!fingerprint) {
    return false
  }

  setWallet({ createdAt: params.createdAt.toISOString(), name: params.name })
  return true
}

export function useCreateWallet(
  options?: Omit<UseMutationOptions<boolean, Error, CreateWalletParams>, 'mutationFn'>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createWallet,
    ...options,
    onSuccess: async (...args) => {
      await invalidateWalletExistence(queryClient)
      options?.onSuccess?.(...args)
    }
  })
}
