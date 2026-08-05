import type { OnchainBalance } from '@/types/domain/balance'
import type { OnchainSnapshot } from '@/types/domain/onchain'
import { useOnchainSnapshot } from './use-onchain-snapshot'
import type { OnchainSnapshotQueryOptions } from './use-onchain-snapshot'

function selectBalance(snapshot: OnchainSnapshot): OnchainBalance {
  return snapshot.balance
}

export function useOnchainBalance(options?: OnchainSnapshotQueryOptions<OnchainBalance>) {
  return useOnchainSnapshot(selectBalance, options)
}
