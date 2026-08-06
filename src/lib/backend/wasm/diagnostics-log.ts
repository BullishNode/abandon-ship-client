// In-memory ring buffer for worker diagnostics. A static WASM deployment has
// no server log to download, so the worker records its own lifecycle and
// failure events here and the settings page exports them as a text file.
// Entries hold operation names and error messages only — never the mnemonic.

export type DiagnosticsLevel = 'info' | 'error'

export interface DiagnosticsLog {
  append: (level: DiagnosticsLevel, message: string) => void
  snapshot: () => string[]
}

const DEFAULT_CAPACITY = 500

export function createDiagnosticsLog(capacity = DEFAULT_CAPACITY): DiagnosticsLog {
  const entries: string[] = []
  let start = 0

  return {
    append: (level, message) => {
      const entry = `${new Date().toISOString()} [${level}] ${message}`
      if (entries.length < capacity) {
        entries.push(entry)
        return
      }
      entries[start] = entry
      start = (start + 1) % capacity
    },
    snapshot: () => [...entries.slice(start), ...entries.slice(0, start)]
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
