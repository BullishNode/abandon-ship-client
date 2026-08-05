import { useWalletStore } from '@/stores/wallet'

// WASM movements have no server-side metadata write (the bindings' Wallet has no
// metadata API). barkd persisted the `bark-web` metadata key on each movement
// server-side; in WASM mode we persist it locally, namespaced by wallet
// fingerprint, and merge it back into movements when the history is mapped.

export const MOVEMENT_METADATA_STORAGE_KEY = 'bark-web-wasm-movement-metadata'

type MovementMetadata = Record<string, unknown>
type FingerprintMetadata = Record<string, MovementMetadata>
type MetadataStore = Record<string, FingerprintMetadata>

function currentFingerprint(): string | undefined {
  return useWalletStore.getState().wallet?.fingerprint
}

function isPlainObject(value: unknown): value is MovementMetadata {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Validate the stored shape instead of trusting it: a corrupted or foreign
// write (primitive where an object is expected) would otherwise throw on the
// next metadata update and break labels until localStorage is cleared.
function readStore(): MetadataStore {
  const raw = localStorage.getItem(MOVEMENT_METADATA_STORAGE_KEY)
  if (raw === null) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isPlainObject(parsed)) {
      return {}
    }
    const store: MetadataStore = {}
    for (const [fingerprint, value] of Object.entries(parsed)) {
      if (!isPlainObject(value)) {
        continue
      }
      const forFingerprint: FingerprintMetadata = {}
      for (const [movementId, metadata] of Object.entries(value)) {
        if (isPlainObject(metadata)) {
          forFingerprint[movementId] = metadata
        }
      }
      store[fingerprint] = forFingerprint
    }
    return store
  } catch {
    return {}
  }
}

function writeStore(store: MetadataStore): void {
  localStorage.setItem(MOVEMENT_METADATA_STORAGE_KEY, JSON.stringify(store))
}

// Replicate barkd's server-side PATCH semantics: merge the incoming patch onto
// the stored metadata, with a null value deleting a key. The app edits one field
// at a time (label, then tags), so a plain overwrite would drop the fields not
// in the current patch.
function mergeMetadata(existing: MovementMetadata, patch: MovementMetadata): MovementMetadata {
  const result = new Map(Object.entries(existing))
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      result.delete(key)
      continue
    }
    const current = result.get(key)
    result.set(
      key,
      isPlainObject(value) && isPlainObject(current) ? mergeMetadata(current, value) : value
    )
  }
  return Object.fromEntries(result)
}

export function setMovementMetadata(movementId: number, metadata: MovementMetadata): void {
  const fingerprint = currentFingerprint()
  if (fingerprint === undefined) {
    return
  }
  const store = readStore()
  const forFingerprint = store[fingerprint] ?? {}
  const key = String(movementId)
  forFingerprint[key] = mergeMetadata(forFingerprint[key] ?? {}, metadata)
  store[fingerprint] = forFingerprint
  writeStore(store)
}

export function getMovementMetadata(movementId: number): MovementMetadata | undefined {
  const fingerprint = currentFingerprint()
  if (fingerprint === undefined) {
    return undefined
  }
  return readStore()[fingerprint]?.[String(movementId)]
}

// Called on wallet delete: a fresh wallet's movement ids restart at 1, so
// stale metadata would otherwise attach to the wrong movements after a
// re-import of the same seed.
export function clearMovementMetadata(fingerprint: string): void {
  const entries = Object.entries(readStore()).filter(([key]) => key !== fingerprint)
  writeStore(Object.fromEntries(entries))
}
