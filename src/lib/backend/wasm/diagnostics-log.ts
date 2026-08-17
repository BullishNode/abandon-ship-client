// In-memory ring buffer for worker diagnostics. A static WASM deployment has
// no server log to download, so the worker records its own lifecycle and
// failure events here and the settings page exports them as a text file.
// Entries hold operation names and error messages only — never the mnemonic.

import { redactErrorMessage } from '@/lib/backend/wasm/diagnostics-redact'

export type DiagnosticsLevel = 'info' | 'error'

export interface DiagnosticsLog {
  append: (level: DiagnosticsLevel, message: string) => void
  snapshot: () => string[]
  // Entries appended since the last drain. The client persists these; the ring
  // buffer keeps them so this session's export stays complete either way.
  drain: () => string[]
}

const DEFAULT_CAPACITY = 500

export function createDiagnosticsLog(capacity = DEFAULT_CAPACITY): DiagnosticsLog {
  const entries: string[] = []
  let start = 0
  // Separate from the ring: a drain must not be able to lose entries the ring
  // has already evicted, and eviction must not silently discard unflushed ones.
  let undrained: string[] = []

  return {
    append: (level, message) => {
      const entry = `${new Date().toISOString()} [${level}] ${message}`
      undrained.push(entry)
      if (entries.length < capacity) {
        entries.push(entry)
        return
      }
      entries[start] = entry
      start = (start + 1) % capacity
    },
    drain: () => {
      const pending = undrained
      undrained = []
      return pending
    },
    snapshot: () => [...entries.slice(start), ...entries.slice(0, start)]
  }
}

// Every logged error goes through here, so the redaction applies to the wrapper
// and the worker's hand-written lines alike. bark's messages interpolate the
// input that failed to parse (addresses, invoices, mnemonic words), which would
// otherwise reappear in the export after the argument redaction stripped it.
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return redactErrorMessage(message)
}
