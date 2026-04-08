import {
  type InvoiceInfo,
  LightningApi,
  type LightningInvoiceRequest
} from '@secondts/barkd'
import { type UseMutationOptions, useMutation } from '@tanstack/react-query'
import { config } from '@/config/barkd'

const lightningApi = new LightningApi(config)

export function useLightningInvoice(
  options?: Omit<
    UseMutationOptions<InvoiceInfo['invoice'], Error, LightningInvoiceRequest>,
    'mutationFn'
  >
) {
  return useMutation({
    mutationFn: (params: LightningInvoiceRequest) =>
      lightningApi
        .generateInvoice({ lightningInvoiceRequest: params })
        .then((response) => response.invoice),
    ...options
  })
}
