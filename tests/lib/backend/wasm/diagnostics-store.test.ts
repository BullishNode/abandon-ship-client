import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendMissingDiagnostics,
  appendPersistedDiagnostics,
  clearPersistedDiagnostics,
  DIAGNOSTICS_STORAGE_KEY,
  readPersistedDiagnostics
} from '@/lib/backend/wasm/diagnostics-store'

const MAX_PERSISTED_ENTRIES = 2000

describe('wasm diagnostics-store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips appended entries', () => {
    appendPersistedDiagnostics(['a', 'b'])
    appendPersistedDiagnostics(['c'])
    expect(readPersistedDiagnostics()).toStrictEqual(['a', 'b', 'c'])
  })

  it('reports no history when nothing is stored', () => {
    expect(readPersistedDiagnostics()).toStrictEqual([])
  })

  it('ignores an empty append rather than rewriting storage', () => {
    appendPersistedDiagnostics([])
    expect(localStorage.getItem(DIAGNOSTICS_STORAGE_KEY)).toBeNull()
  })

  it('degrades to no history on unparseable storage', () => {
    localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, '{not json')
    expect(readPersistedDiagnostics()).toStrictEqual([])
  })

  it('degrades to no history on a foreign stored shape', () => {
    localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, JSON.stringify({ entries: ['a'] }))
    expect(readPersistedDiagnostics()).toStrictEqual([])
  })

  it('rejects an array holding non-string entries', () => {
    localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, JSON.stringify(['a', 42]))
    expect(readPersistedDiagnostics()).toStrictEqual([])
  })

  it('drops the oldest entries beyond the cap', () => {
    const entries = Array.from({ length: MAX_PERSISTED_ENTRIES + 10 }, (_, i) => `entry-${i}`)
    appendPersistedDiagnostics(entries)
    const stored = readPersistedDiagnostics()
    expect(stored).toHaveLength(MAX_PERSISTED_ENTRIES)
    expect(stored.at(0)).toBe('entry-10')
    expect(stored.at(-1)).toBe(`entry-${MAX_PERSISTED_ENTRIES + 9}`)
  })

  it('enforces the cap across separate appends', () => {
    appendPersistedDiagnostics(Array.from({ length: MAX_PERSISTED_ENTRIES }, (_, i) => `old-${i}`))
    appendPersistedDiagnostics(['newest'])
    const stored = readPersistedDiagnostics()
    expect(stored).toHaveLength(MAX_PERSISTED_ENTRIES)
    expect(stored.at(-1)).toBe('newest')
    expect(stored).not.toContain('old-0')
  })

  it('survives a storage write failure instead of throwing', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => {
      appendPersistedDiagnostics(['a'])
    }).not.toThrow()
    setItem.mockRestore()
  })

  it('clears stored entries', () => {
    appendPersistedDiagnostics(['a'])
    clearPersistedDiagnostics()
    expect(readPersistedDiagnostics()).toStrictEqual([])
  })
})

describe(appendMissingDiagnostics, () => {
  it('appends worker entries the store is missing', () => {
    expect(appendMissingDiagnostics(['a'], ['a', 'b'])).toStrictEqual(['a', 'b'])
  })

  it('contributes nothing when the worker view is already flushed', () => {
    expect(appendMissingDiagnostics(['a', 'b'], ['a', 'b'])).toStrictEqual(['a', 'b'])
  })

  it('keeps persisted history when the worker buffer is empty', () => {
    expect(appendMissingDiagnostics(['a'], [])).toStrictEqual(['a'])
  })

  it('returns the worker buffer when nothing is persisted', () => {
    expect(appendMissingDiagnostics([], ['a'])).toStrictEqual(['a'])
  })

  // A ring-evicted worker snapshot no longer starts where storage ends.
  it('appends the whole snapshot when it does not overlap storage', () => {
    expect(appendMissingDiagnostics(['a'], ['b', 'c'])).toStrictEqual(['a', 'b', 'c'])
  })

  // Regression: identical lines are legitimate (same message, same millisecond).
  // Set-based dedupe collapsed three real entries into one.
  it('preserves duplicate entries rather than collapsing them', () => {
    const line = '2026-08-17T12:00:00.000Z [info] notification received (MovementCreated)'
    expect(appendMissingDiagnostics([line], [line, line])).toStrictEqual([line, line])
  })

  // Regression: concatenating a drained tail put older entries after newer ones.
  it('keeps entries in chronological order', () => {
    const older = '2026-08-17T12:00:01.000Z [info] a'
    const newer = '2026-08-17T12:00:05.000Z [info] b'
    expect(appendMissingDiagnostics([older], [older, newer])).toStrictEqual([older, newer])
  })
})
