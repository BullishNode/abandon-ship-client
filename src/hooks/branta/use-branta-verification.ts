/* eslint-disable require-await */
import { useQuery } from '@tanstack/react-query'
import { brantaClient } from '@/config/branta'
import type { Payment } from '@branta-ops/branta'

export function useBrantaVerification(qrCode: string | undefined) {
  return useQuery<Payment[]>({
    enabled: qrCode !== undefined && qrCode !== '',
    gcTime: 0,
    queryFn: async () => brantaClient.getPaymentsByQRCode(qrCode ?? ''),
    queryKey: ['branta', 'verification', qrCode],
    retry: false
  })
}
