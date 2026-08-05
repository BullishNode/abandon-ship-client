import type { Config, Network as WasmNetwork } from '@secondts/bark'
import { config } from '@/config/runtime'
import type { Network } from '@/types/domain/network'
import { esploraUrl } from '@/utils/chain-source'

// The WASM bindings target Bitcoin (mainnet), Signet, and Regtest. Mutinynet is
// a signet variant, so it maps onto Signet; regtest is passed through for local
// testing.
export function toWasmNetwork(network: Network): WasmNetwork {
  if (network === 'mainnet') {
    return 'Bitcoin'
  }
  if (network === 'regtest') {
    return 'Regtest'
  }
  return 'Signet'
}

// Config for both `Wallet.open` and `OnchainWallet.default`. The browser talks
// to the ark server and esplora directly, so both addresses come straight from
// the build-time runtime config (no Hono proxy, no bitcoind).
export function buildWasmConfig(): Config {
  return {
    esploraAddress: esploraUrl(config.chainSource),
    serverAddress: config.arkServer
  }
}

// A stable IndexedDB database name for the onchain wallet, derived from the ark
// network so signet and mainnet wallets never share a store. The ark (offchain)
// wallet uses the bindings' fingerprint-derived default name.
export function onchainDbName(): string {
  return `bark-onchain-${config.network}`
}
