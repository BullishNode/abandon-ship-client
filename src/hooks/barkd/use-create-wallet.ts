import { type CreateWalletRequest, WalletApi } from '@secondts/barkd'
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient
} from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { useWalletStore } from '@/stores/wallet'

const walletApi = new WalletApi(config)
interface CreateWalletParams extends CreateWalletRequest {
  name: string
  mnemonic: string
  createdAt: Date
}

async function createWallet(params: CreateWalletParams) {
  const setWallet = useWalletStore.getState().setWallet

  const response = await walletApi.createWallet({
    createWalletRequest: {
      arkServer: params.arkServer,
      chainSource: params.chainSource,
      network: params.network,
      mnemonic: params.mnemonic
    }
  })
  const fingerprint = response.fingerprint

  if (!fingerprint) {
    return false
  }

  setWallet({ name: params.name, createdAt: params.createdAt.toISOString() })
  return true
}

export function useCreateWallet(
  options?: Omit<
    UseMutationOptions<boolean, Error, CreateWalletParams>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createWallet,
    ...options,
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ['wallet', 'exists'] })
      options?.onSuccess?.(...args)
    }
  })
}
