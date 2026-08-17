// Persistence for worker diagnostics. The log lives in worker memory, which is
// lost on reload and on the terminateWorker() that every wallet delete performs
// — exactly when support is asked for it ("it broke, I reloaded, then exported").
//
// localStorage, not IndexedDB: WASM-held IDB connections are why terminateWorker
// exists at all (they block deleteDatabase indefinitely), and a diagnostics log
// is not worth reintroducing that failure mode. localStorage is synchronous and
// holds no connection, so it can never block a wallet delete.
//
// Workers cannot reach localStorage, so the worker accumulates entries and this
// client-realm module owns the writes.
//
// Not namespaced by fingerprint, unlike movement metadata: the most valuable
// entries (wasm init failed, open failed) happen before any wallet is open, so
// there is no fingerprint to key them by. Cleared on wallet delete, so no trace
// of a removed wallet's activity outlives it.

export const DIAGNOSTICS_STORAGE_KEY = 'bark-web-wasm-diagnostics'

const MAX_PERSISTED_ENTRIES = 2000

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

// Validate rather than trust: a corrupted or foreign write must degrade to "no
// history" instead of throwing on every later append.
export function readPersistedDiagnostics(): string[] {
  const raw = localStorage.getItem(DIAGNOSTICS_STORAGE_KEY)
  if (raw === null) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return isStringArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Diagnostics must never break the wallet: a full or unavailable localStorage
// (quota, private-mode restrictions) drops the entries silently.
function write(entries: string[]): void {
  try {
    localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Persistence is best-effort; the in-memory log still serves this session.
  }
}

// Oldest entries are dropped first, mirroring the worker's ring buffer.
export function appendPersistedDiagnostics(entries: readonly string[]): void {
  if (entries.length === 0) {
    return
  }
  const combined = [...readPersistedDiagnostics(), ...entries]
  write(combined.slice(-MAX_PERSISTED_ENTRIES))
}

export function clearPersistedDiagnostics(): void {
  localStorage.removeItem(DIAGNOSTICS_STORAGE_KEY)
}

// Appends only the worker entries that storage is missing, matching by position
// rather than by content.
//
// Content-based dedupe is wrong here: entries are not unique (the same message
// logged twice inside one millisecond yields two identical lines), so a Set
// collapses real repeats. Both lists are append-ordered from one worker, so the
// stored tail is a prefix of the worker's view of this session — the entries
// after that overlap are the ones still missing.
// Longest k where the last k of `persisted` equal the first k of `snapshot`.
// Bounded by the shorter list, so a fully-flushed snapshot contributes nothing.
function longestSuffixPrefixOverlap(
  persisted: readonly string[],
  snapshot: readonly string[]
): number {
  const limit = Math.min(persisted.length, snapshot.length)
  for (let size = limit; size > 0; size -= 1) {
    const tail = persisted.slice(persisted.length - size)
    if (tail.every((entry, index) => entry === snapshot[index])) {
      return size
    }
  }
  return 0
}

export function appendMissingDiagnostics(
  persisted: readonly string[],
  workerSnapshot: readonly string[]
): string[] {
  const overlap = longestSuffixPrefixOverlap(persisted, workerSnapshot)
  return [...persisted, ...workerSnapshot.slice(overlap)]
}
