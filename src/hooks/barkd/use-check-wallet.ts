import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { DEFAULT_WALLET_NAME } from '@/constants/wallet'
import { walletApi } from '@/lib/barkd-client'
import { walletKeys } from '@/lib/query-keys'
import { useWalletStore } from '@/stores/wallet'

async function checkWallet() {
  const response = await walletApi.walletExists()
  const { fingerprint } = response
  if (fingerprint === null || fingerprint === undefined || fingerprint.length === 0) {
    return false
  }
  useWalletStore.setState((state) => {
    if (state.wallet === null) {
      return {
        wallet: {
          createdAt: new Date().toISOString(),
          fingerprint,
          name: DEFAULT_WALLET_NAME
        }
      }
    }
    if (state.wallet.fingerprint !== fingerprint) {
      return { wallet: { ...state.wallet, fingerprint } }
    }
    return state
  })
  return true
}

export function useCheckWallet(options?: Omit<UseQueryOptions<boolean>, 'queryKey' | 'queryFn'>) {
  return useQuery({
    queryFn: checkWallet,
    queryKey: walletKeys.exists(),
    retry: false,
    ...options
  })
}
