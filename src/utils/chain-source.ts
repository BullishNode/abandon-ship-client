import type { ChainSource } from '@/types/domain/chain-source'

// Display-only. Cookie file paths are never surfaced in the UI.
export function chainSourceLabel(chainSource: ChainSource): string {
  return 'esplora' in chainSource ? chainSource.esplora.url : chainSource.bitcoind.bitcoind
}

// The wasm build always runs against esplora — a browser cannot read a bitcoind
// cookie file. `loadWasmConfig` guarantees the variant; this guards the boundary
// for callers that need the bare URL.
export function esploraUrl(chainSource: ChainSource): string {
  if ('esplora' in chainSource) {
    return chainSource.esplora.url
  }
  throw new Error('Chain source is not esplora')
}
