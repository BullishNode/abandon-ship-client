import type { Destination } from 'bitcoin-decoder'
import { decode } from 'bitcoin-decoder'
import { normalizeDestination } from '@/utils/bitcoin'

export type SendRoute = 'ark' | 'lightning' | 'onchain-from-ark' | 'onchain-from-wallet'

export function sanitizePaymentInput(input: string): string {
  return input.replaceAll(/\s+/gu, '')
}

export async function parsePaymentInput(input: string) {
  const decoded = await decode(sanitizePaymentInput(input))
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

const DESTINATION_PRIORITY: Record<Destination['type'], number> = {
  'ark-address': 0,
  'bitcoin-address': 2,
  bolt11: 1,
  bolt12: 1,
  lnaddress: 1,
  lnurl: 1
}

export function sortDestinationsByPriority(destinations: Destination[]): Destination[] {
  return [...destinations].toSorted(
    (a, b) => DESTINATION_PRIORITY[a.type] - DESTINATION_PRIORITY[b.type]
  )
}

export function pickCheapestDestination(destinations: Destination[]): Destination {
  return sortDestinationsByPriority(destinations)[0]
}

export function getSelectableDestinations(destinations: Destination[]): Destination[] {
  return sortDestinationsByPriority(destinations).map(normalizeDestination)
}
