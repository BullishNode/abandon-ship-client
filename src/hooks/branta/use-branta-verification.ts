import { useQuery } from '@tanstack/react-query'
import { brantaClient } from '@/config/branta'
import type { Payment } from '@branta-ops/branta'

export function useBrantaVerification(qrCode: string | undefined) {
  return useQuery<Payment[]>({
    enabled: !!qrCode,
    queryFn: async () => await brantaClient.getPaymentsByQRCode(qrCode!),
    queryKey: ['branta', 'verification', qrCode],
    retry: false,
    gcTime: 0
  })
}
