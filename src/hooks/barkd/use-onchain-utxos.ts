import type { OnchainSnapshot, Utxo } from '@/types/domain/onchain'
import { useOnchainSnapshot } from './use-onchain-snapshot'
import type { OnchainSnapshotQueryOptions } from './use-onchain-snapshot'

function selectUtxos(snapshot: OnchainSnapshot): Utxo[] {
  return snapshot.utxos
}

export function useOnchainUtxos(options?: OnchainSnapshotQueryOptions<Utxo[]>) {
  return useOnchainSnapshot(selectUtxos, options)
}
