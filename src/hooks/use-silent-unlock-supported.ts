import { useQuery } from '@tanstack/react-query'
import { isSilentUnlockSupported } from '@/lib/onboarding-password'
import { walletKeys } from '@/lib/query-keys'

export function useSilentUnlockSupported() {
  return useQuery({
    queryFn: isSilentUnlockSupported,
    queryKey: walletKeys.silentUnlock(),
    staleTime: Number.POSITIVE_INFINITY
  })
}
