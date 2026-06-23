import type { WalletTxInfo } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { onchainApi } from '@/lib/barkd-client'
import { onchainKeys } from '@/lib/query-keys'
import { useMetadataStore } from '@/stores/metadata'
import { hasPendingOffboards, usePendingOffboardsStore } from '@/stores/pending-offboards'

const FAST_REFETCH_MS = 3000
const DEFAULT_REFETCH_MS = 30_000

export function useOnchainTransactions(
  options?: Omit<UseQueryOptions<WalletTxInfo[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => {
      const transactions = await onchainApi.onchainTransactions()
      const txids = transactions.map((tx) => tx.txid)
      useMetadataStore.getState().recordOnchainFirstSeen(txids)
      usePendingOffboardsStore.getState().reconcile(txids, Date.now())
      return transactions
    },
    queryKey: onchainKeys.transactions(),
    refetchInterval: () => (hasPendingOffboards() ? FAST_REFETCH_MS : DEFAULT_REFETCH_MS),
    ...options
  })
}
