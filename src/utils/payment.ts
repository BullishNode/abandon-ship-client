import type { DecodedPayment, Destination } from 'bitcoin-decoder'
import { decode } from 'bitcoin-decoder'
import type { Network } from '@/types/domain/network'
import { isValidOnchainAddress, normalizeDestination } from '@/utils/bitcoin'

export type SendRoute = 'ark' | 'lightning' | 'onchain-from-ark' | 'onchain-from-wallet'

export function sanitizePaymentInput(input: string): string {
  return input.replaceAll(/\s+/gu, '')
}

export async function parsePaymentInput(input: string) {
  const decoded = await decode(sanitizePaymentInput(input))
  return decoded
}

// `DecodedPayment.network` is derived from one rail only — the lightning one for
// a BIP-321 URI — and folds signet, mutinynet, and regtest together, so each
// destination is checked on its own instead.
type DestinationNetwork = 'mainnet' | 'signet' | 'regtest' | 'any-testnet' | 'unknown'

const BOLT11_NETWORK_PREFIXES: readonly (readonly [string, DestinationNetwork])[] = [
  ['lnbcrt', 'regtest'],
  ['lntbs', 'signet'],
  ['lntb', 'any-testnet'],
  ['lnbc', 'mainnet']
]

function bolt11Network(invoice: string): DestinationNetwork {
  const lower = invoice.toLowerCase()
  const match = BOLT11_NETWORK_PREFIXES.find(([prefix]) => lower.startsWith(prefix))
  return match?.[1] ?? 'unknown'
}

function arkNetwork(arkAddress: string): DestinationNetwork {
  const lower = arkAddress.toLowerCase()
  if (lower.startsWith('tark1')) {
    return 'any-testnet'
  }
  if (lower.startsWith('ark1')) {
    return 'mainnet'
  }
  return 'unknown'
}

function walletAccepts(destinationNetwork: DestinationNetwork, walletNetwork: Network): boolean {
  if (destinationNetwork === 'unknown') {
    return true
  }
  if (walletNetwork === 'mainnet') {
    return destinationNetwork === 'mainnet'
  }
  if (destinationNetwork === 'mainnet') {
    return false
  }
  if (destinationNetwork === 'any-testnet') {
    return true
  }
  return destinationNetwork === (walletNetwork === 'regtest' ? 'regtest' : 'signet')
}

// A BOLT12 offer carries its chain in the `offer_chains` TLV rather than in the
// bech32 prefix, and lnurl/lightning addresses only resolve to an invoice after
// a server round trip, so neither can be checked here.
export function destinationMatchesWalletNetwork(
  destination: Destination,
  walletNetwork: Network
): boolean {
  if (destination.type === 'bitcoin-address') {
    return isValidOnchainAddress(destination.value, walletNetwork)
  }
  if (destination.type === 'ark-address') {
    return walletAccepts(arkNetwork(destination.value), walletNetwork)
  }
  if (destination.type === 'bolt11') {
    return walletAccepts(bolt11Network(destination.value), walletNetwork)
  }
  return true
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

export interface SendRouteBalances {
  arkSpendableSat: number
  onchainSpendableSat: number
}

// An empty Ark wallet can't fund an on-chain send, so default to the on-chain
// wallet when it is the only side holding funds. The user can still switch
// sources afterwards.
export function getDefaultSendRoute(
  destinationType: Destination['type'],
  balances: SendRouteBalances
): SendRoute {
  const route = getSendRoute(destinationType)
  if (
    route === 'onchain-from-ark' &&
    balances.arkSpendableSat === 0 &&
    balances.onchainSpendableSat > 0
  ) {
    return 'onchain-from-wallet'
  }
  return route
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

// Returns undefined when no rail is payable; a URI with a single off-network
// rail keeps the others.
export function restrictPaymentToNetwork(
  decoded: DecodedPayment,
  walletNetwork: Network
): DecodedPayment | undefined {
  const payable = decoded.destinations.filter((destination) =>
    destinationMatchesWalletNetwork(destination, walletNetwork)
  )
  if (payable.length === 0) {
    return undefined
  }
  if (payable.length === decoded.destinations.length) {
    return decoded
  }
  return { ...decoded, destination: pickCheapestDestination(payable), destinations: payable }
}
