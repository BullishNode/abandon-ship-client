/* eslint-disable require-await */
import { useQuery } from '@tanstack/react-query'
import { brantaClient } from '@/config/branta'
import { brantaKeys } from '@/lib/query-keys'
import type { Payment } from '@branta-ops/branta'

export function useBrantaVerification(qrCode: string | undefined) {
  return useQuery<Payment[]>({
    enabled: qrCode !== undefined && qrCode !== '',
    gcTime: 0,
    queryFn: async () => await brantaClient.getPaymentsByQRCode(qrCode ?? ''),
    queryKey: brantaKeys.verification(qrCode),
    retry: false
  })
}
