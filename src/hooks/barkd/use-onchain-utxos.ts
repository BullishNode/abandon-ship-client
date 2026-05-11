import type { UtxoInfo } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { onchainApi } from '@/lib/barkd-client'
import { onchainKeys } from '@/lib/query-keys'

export function useOnchainUtxos(
  options?: Omit<UseQueryOptions<UtxoInfo[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryFn: async () => await onchainApi.onchainUtxos(),
    queryKey: onchainKeys.utxos(),
    refetchInterval: 30_000,
    ...options
  })
}
