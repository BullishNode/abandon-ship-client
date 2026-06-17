import type { Destination } from 'bitcoin-decoder'

const SATS_PER_BTC = 100_000_000

const SEGWIT_HRPS = ['bc', 'tb', 'bcrt'] as const

const LOWERCASE_DESTINATION_TYPES = new Set<Destination['type']>([
  'ark-address',
  'bolt11',
  'bolt12',
  'lnaddress'
])

export function normalizeBitcoinAddress(address: string): string {
  const lower = address.toLowerCase()
  if (SEGWIT_HRPS.some((hrp) => lower.startsWith(`${hrp}1`))) {
    return lower
  }
  return address
}

export function normalizeDestination(destination: Destination): Destination {
  if (destination.type === 'bitcoin-address') {
    return { ...destination, destination: normalizeBitcoinAddress(destination.destination) }
  }
  if (LOWERCASE_DESTINATION_TYPES.has(destination.type)) {
    return { ...destination, destination: destination.destination.toLowerCase() }
  }
  return destination
}

export function btcToSats(btc: number) {
  return Math.round(btc * SATS_PER_BTC)
}

export function satsToBTC(sats: number) {
  return sats / SATS_PER_BTC
}
