import type { OnchainSnapshot, WalletTx } from '@/types/domain/onchain'
import { useOnchainSnapshot } from './use-onchain-snapshot'
import type { OnchainSnapshotQueryOptions } from './use-onchain-snapshot'

function selectTransactions(snapshot: OnchainSnapshot): WalletTx[] {
  return snapshot.transactions
}

export function useOnchainTransactions(options?: OnchainSnapshotQueryOptions<WalletTx[]>) {
  return useOnchainSnapshot(selectTransactions, options)
}
