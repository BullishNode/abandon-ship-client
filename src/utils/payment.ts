import type { Destination } from 'bitcoin-decoder'
import { decode } from 'bitcoin-decoder'

export type SendRoute = 'ark' | 'lightning' | 'onchain-from-ark' | 'onchain-from-wallet'

export async function parsePaymentInput(input: string) {
  const decoded = await decode(input.trim())
  return decoded
}

export function getSendRoute(destinationType: Destination['type']): SendRoute {
  if (destinationType === 'ark-address') {
    return 'ark'
  }
  if (
    destinationType === 'bolt11' ||
    destinationType === 'bolt12' ||
    destinationType === 'lnaddress' ||
    destinationType === 'lnurl'
  ) {
    return 'lightning'
  }
  return 'onchain-from-ark'
}
