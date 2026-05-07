import { LightningApi } from '@secondts/barkd'
import { useQuery } from '@tanstack/react-query'
import { config } from '@/config/barkd'
import { lightningKeys } from '@/lib/query-keys'

const lightningApi = new LightningApi(config)

interface UseLightningInvoiceOptions {
  amountSat: number | undefined
  enabled: boolean
}

export function useLightningInvoice({ amountSat, enabled }: UseLightningInvoiceOptions) {
  return useQuery({
    enabled: enabled && amountSat !== undefined,
    queryFn: async () => {
      if (amountSat === undefined) {
        throw new Error('amountSat is required to generate an invoice')
      }
      const response = await lightningApi.generateInvoice({
        lightningInvoiceRequest: { amountSat }
      })
      return response.invoice
    },
    queryKey: lightningKeys.invoice(amountSat),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY
  })
}
