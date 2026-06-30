import type { QueryClient } from '@tanstack/react-query'
import { exitKeys, onchainKeys, walletKeys } from './query-keys'

export async function invalidateWalletState(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: walletKeys.balance() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.transactions() })
  ])
}

export async function invalidateMovements(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: walletKeys.transactions() })
}

export async function invalidateMovementState(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: walletKeys.balance() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.transactions() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.vtxos() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.vtxosAll() })
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

export async function resetWalletQueriesAfterDelete(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: walletKeys.autoCreate() })
  queryClient.removeQueries({ queryKey: walletKeys.balance() })
  queryClient.removeQueries({ queryKey: walletKeys.transactions() })
  queryClient.removeQueries({ queryKey: exitKeys.all })
  await invalidateWalletExistence(queryClient)
}

export async function invalidateRefreshState(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: walletKeys.balance() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.vtxos() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.vtxosAll() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.pendingRounds() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.transactions() })
  ])
}

export async function invalidateOffboardState(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: walletKeys.balance() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.vtxos() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.vtxosAll() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.transactions() }),
    queryClient.invalidateQueries({ queryKey: onchainKeys.balance() }),
    queryClient.invalidateQueries({ queryKey: onchainKeys.transactions() })
  ])
}

export async function invalidateExitState(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: exitKeys.status() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.vtxos() }),
    queryClient.invalidateQueries({ queryKey: walletKeys.vtxosAll() }),
    invalidateWalletState(queryClient),
    invalidateOnchainState(queryClient)
  ])
}
