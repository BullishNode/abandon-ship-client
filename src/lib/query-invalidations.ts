import type { QueryClient } from '@tanstack/react-query'
import { onchainKeys, walletKeys } from './query-keys'

export async function invalidateWalletState(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: walletKeys.balance() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.transactions() })
  ])
}

export async function invalidateOnchainState(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: onchainKeys.balance() }),
    queryClient.invalidateQueries({ queryKey: onchainKeys.transactions() })
  ])
}

export async function invalidateWalletExistence(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: walletKeys.exists() })
}
