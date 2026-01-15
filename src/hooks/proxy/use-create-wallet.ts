import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useWalletStore } from '@/stores/wallet'

const PROXY_URL = import.meta.env.VITE_PROXY_URL

interface CreateWalletParams {
  name: string
  mnemonic: string
  createdAt: Date
}

async function createWallet(params: CreateWalletParams) {
  const setWallet = useWalletStore.getState().setWallet
  const response = await fetch(`${PROXY_URL}/api/v1/wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ mnemonic: params.mnemonic })
  })

  if (!response.ok) {
    return false
  }

  setWallet({ name: params.name, createdAt: params.createdAt.toISOString() })
  return true
}

export function useCreateWallet(
  options?: Omit<UseMutationOptions<boolean, Error, CreateWalletParams>, 'mutationFn'>
) {
  return useMutation({
    ...options,
    mutationFn: createWallet
  })
}
