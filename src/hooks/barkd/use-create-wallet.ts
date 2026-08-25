import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { walletApi } from '@/lib/barkd-client'
import { invalidateWalletExistence } from '@/lib/query-invalidations'
import { useWalletStore } from '@/stores/wallet'

interface CreateWalletParams {
  name: string
  mnemonic: string
  createdAt: Date
  birthdayHeight?: number
  restore?: boolean
}

interface CreateWalletOutcome {
  created: boolean
  scanIncomplete: boolean
}

async function createWallet(params: CreateWalletParams): Promise<CreateWalletOutcome> {
  const { setWallet } = useWalletStore.getState()

  const response = await walletApi.createWallet({
    birthdayHeight: params.birthdayHeight,
    mnemonic: params.mnemonic,
    restore: params.restore
  })
  const { fingerprint, scanIncomplete } = response

  if (!fingerprint) {
    return { created: false, scanIncomplete: false }
  }

  setWallet({ createdAt: params.createdAt.toISOString(), fingerprint, name: params.name })
  return { created: true, scanIncomplete: scanIncomplete ?? false }
}

export function useCreateWallet(
  options?: Omit<UseMutationOptions<CreateWalletOutcome, Error, CreateWalletParams>, 'mutationFn'>
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
