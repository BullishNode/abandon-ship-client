import { useQuery } from '@tanstack/react-query'
import { fallbackRegistration } from '@/lib/backend/barkd/fallback'
import { walletKeys } from '@/lib/query-keys'

export function useFallbackRegistration() {
  return useQuery({
    enabled: __BACKEND__ !== 'wasm',
    queryFn: fallbackRegistration,
    queryKey: [...walletKeys.all, 'fallback'],
    refetchInterval: 30_000,
    retry: 1
  })
}
