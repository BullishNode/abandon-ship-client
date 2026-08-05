import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { FAST_REFETCH_MS, ONCHAIN_REFETCH_MS } from '@/constants/refetch'
import { onchainApi } from '@/lib/barkd-client'
import { onchainKeys } from '@/lib/query-keys'
import { useMetadataStore } from '@/stores/metadata'
import { hasPendingOffboards, usePendingOffboardsStore } from '@/stores/pending-offboards'
import type { OnchainSnapshot } from '@/types/domain/onchain'

export type OnchainSnapshotQueryOptions<TData> = Omit<
  UseQueryOptions<OnchainSnapshot, Error, TData>,
  'queryKey' | 'queryFn' | 'select'
>

async function fetchOnchainSnapshot(): Promise<OnchainSnapshot> {
  const [balance, transactions, utxos] = await Promise.all([
    onchainApi.onchainBalance(),
    onchainApi.onchainTransactions(),
    onchainApi.onchainUtxos()
  ])
  const txids = transactions.map((tx) => tx.txid)
  useMetadataStore.getState().recordOnchainFirstSeen(txids)
  usePendingOffboardsStore.getState().reconcile(txids, Date.now())
  return { balance, transactions, utxos }
}

export function useOnchainSnapshot<TData>(
  select: (snapshot: OnchainSnapshot) => TData,
  options?: OnchainSnapshotQueryOptions<TData>
) {
  return useQuery({
    queryFn: fetchOnchainSnapshot,
    queryKey: onchainKeys.snapshot(),
    refetchInterval: () => (hasPendingOffboards() ? FAST_REFETCH_MS : ONCHAIN_REFETCH_MS),
    select,
    ...options
  })
}
