/* eslint-disable require-await */
import type { PaymentsResult } from '@branta-ops/branta/v2'
import { useQuery } from '@tanstack/react-query'
import { brantaClient } from '@/config/branta'
import { brantaKeys } from '@/lib/query-keys'

export function useBrantaVerification(qrCode: string | undefined) {
  return useQuery<PaymentsResult>({
    enabled: qrCode !== undefined && qrCode !== '',
    gcTime: 0,
    queryFn: async () => await brantaClient.getPaymentsByQrCode(qrCode ?? ''),
    queryKey: brantaKeys.verification(qrCode),
    retry: false
  })
}
