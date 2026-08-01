import type { ChainSourceConfig } from '@secondts/barkd'

// Display-only. Cookie file paths are never surfaced in the UI.
export function chainSourceLabel(chainSource: ChainSourceConfig): string {
  return 'esplora' in chainSource ? chainSource.esplora.url : chainSource.bitcoind.bitcoind
}
