import type { Destination } from 'bitcoin-decoder'
import { address as addressLib, networks } from 'bitcoinjs-lib'
import type { Network } from '@/types/domain/network'

const SATS_PER_BTC = 100_000_000

export function networkFor(network: Network): networks.Network {
  if (network === 'mainnet') {
    return networks.bitcoin
  }
  if (network === 'regtest') {
    return networks.regtest
  }
  return networks.testnet
}

const WITNESS_V0_LENGTHS = new Set([20, 32])
const TAPROOT_PROGRAM_LENGTH = 32

function isValidBech32Address(trimmed: string, net: networks.Network): boolean {
  const { prefix, version, data } = addressLib.fromBech32(trimmed)
  if (prefix !== net.bech32) {
    return false
  }
  if (version === 0) {
    return WITNESS_V0_LENGTHS.has(data.length)
  }
  if (version === 1) {
    return data.length === TAPROOT_PROGRAM_LENGTH
  }
  return false
}

// `address.toOutputScript` builds a p2tr payment for witness v1, which requires
// an initialized ECC library. We only need to validate the encoding/network, so
// decode directly with fromBech32/fromBase58Check to avoid that dependency.
export function isValidOnchainAddress(addr: string, network: Network): boolean {
  const trimmed = addr.trim()
  if (trimmed.length === 0) {
    return false
  }
  const net = networkFor(network)
  try {
    const { version } = addressLib.fromBase58Check(trimmed)
    return version === net.pubKeyHash || version === net.scriptHash
  } catch {
    // not base58; fall through to bech32
  }
  try {
    return isValidBech32Address(trimmed, net)
  } catch {
    return false
  }
}

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
