import { useWalletStore } from '@/stores/wallet'

// The worker keeps handed-out onchain addresses in memory only, so after a page
// reload onchain transactions/utxos (which esplora is queried for per address)
// would come back empty. Persist handed-out addresses locally, namespaced by
// wallet fingerprint, mirroring the movement metadata store.

export const ONCHAIN_ADDRESSES_STORAGE_KEY = 'bark-web-wasm-onchain-addresses'

type AddressStore = Record<string, string[]>

function currentFingerprint(): string | undefined {
  return useWalletStore.getState().wallet?.fingerprint
}

function readStore(): AddressStore {
  const raw = localStorage.getItem(ONCHAIN_ADDRESSES_STORAGE_KEY)
  if (raw === null) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }
    const store: AddressStore = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        store[key] = value.filter((item): item is string => typeof item === 'string')
      }
    }
    return store
  } catch {
    return {}
  }
}

export function rememberOnchainAddress(address: string): void {
  const fingerprint = currentFingerprint()
  if (fingerprint === undefined) {
    return
  }
  const store = readStore()
  const existing = store[fingerprint] ?? []
  if (existing.includes(address)) {
    return
  }
  store[fingerprint] = [...existing, address]
  localStorage.setItem(ONCHAIN_ADDRESSES_STORAGE_KEY, JSON.stringify(store))
}

export function getStoredOnchainAddresses(): string[] {
  const fingerprint = currentFingerprint()
  if (fingerprint === undefined) {
    return []
  }
  return readStore()[fingerprint] ?? []
}

// Called on wallet delete: a re-import of the same seed gets a fresh wallet,
// so stale addresses must not resurface in its onchain history.
export function clearStoredOnchainAddresses(fingerprint: string): void {
  const entries = Object.entries(readStore()).filter(([key]) => key !== fingerprint)
  localStorage.setItem(ONCHAIN_ADDRESSES_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
}
