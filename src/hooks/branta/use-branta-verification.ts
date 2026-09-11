import type { PaymentsResult } from '@branta-ops/branta/v2'
import { useQuery } from '@tanstack/react-query'
import { brantaClient, getBrantaClientOptions } from '@/config/branta'
import { brantaKeys } from '@/lib/query-keys'
import { useSettingsStore } from '@/stores/settings'

export function useBrantaVerification(qrCode: string | undefined) {
  const brantaMode = useSettingsStore((state) => state.brantaMode)
  const clientOptions = brantaMode === 'off' ? undefined : getBrantaClientOptions(brantaMode)
  const hasQrCode = qrCode !== undefined && qrCode !== ''
  return useQuery<PaymentsResult>({
    enabled: clientOptions !== undefined && hasQrCode,
    gcTime: 0,
    queryFn: async ({ signal }) =>
      await brantaClient.getPaymentsByQrCode(qrCode ?? '', clientOptions, signal),
    queryKey: brantaKeys.verification(qrCode, brantaMode),
    retry: false
  })
}
