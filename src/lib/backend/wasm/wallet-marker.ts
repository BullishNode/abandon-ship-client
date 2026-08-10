import { config } from '@/config/runtime'

// Fallback wallet-existence signal for browsers without indexedDB.databases()
// (older Firefox, some private modes). There, hasStoredWallet() cannot
// enumerate databases and would report "no wallet", routing a reload to the
// create flow where a brand-new wallet could shadow the persisted one (and
// reopen the shared onchain DB with a different seed). The marker is only
// consulted when enumeration is unavailable, so clearing localStorage alone
// can never strand a browser that supports enumeration.

const STORAGE_KEY_PREFIX = 'bark-web-wasm-wallet-exists'

function markerKey(): string {
  return `${STORAGE_KEY_PREFIX}-${config.network}`
}

export function setWalletMarker(): void {
  localStorage.setItem(markerKey(), 'true')
}

export function clearWalletMarker(): void {
  localStorage.removeItem(markerKey())
}

export function hasWalletMarker(): boolean {
  return localStorage.getItem(markerKey()) === 'true'
}
