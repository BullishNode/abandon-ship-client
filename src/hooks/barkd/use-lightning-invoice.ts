import { LightningApi } from '@secondts/barkd'
import type { InvoiceInfo, LightningInvoiceRequest } from '@secondts/barkd'
import { useMutation } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const lightningApi = new LightningApi(config)

export function useLightningInvoice(
  options?: Omit<
    UseMutationOptions<InvoiceInfo['invoice'], Error, LightningInvoiceRequest>,
    'mutationFn'
  >
) {
  return useMutation({
    mutationFn: async (params: LightningInvoiceRequest) => {
      const response = await lightningApi.generateInvoice({ lightningInvoiceRequest: params })
      return response.invoice
    },
    ...options
  })
}
