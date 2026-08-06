import { describe, expect, it } from 'vitest'
import { createDiagnosticsLog, describeError } from '@/lib/backend/wasm/diagnostics-log'

describe(createDiagnosticsLog, () => {
  it('formats entries with timestamp and level', () => {
    const log = createDiagnosticsLog(3)
    log.append('info', 'wallet opened')
    const [entry] = log.snapshot()
    expect(entry).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[info\] wallet opened$/u)
  })

  it('keeps insertion order below capacity', () => {
    const log = createDiagnosticsLog(3)
    log.append('info', 'a')
    log.append('error', 'b')
    const messages = log.snapshot().map((entry) => entry.split('] ')[1])
    expect(messages).toStrictEqual(['a', 'b'])
  })

  it('evicts the oldest entries once capacity is reached', () => {
    const log = createDiagnosticsLog(3)
    for (const message of ['a', 'b', 'c', 'd', 'e']) {
      log.append('info', message)
    }
    const messages = log.snapshot().map((entry) => entry.split('] ')[1])
    expect(messages).toStrictEqual(['c', 'd', 'e'])
  })

  it('returns a copy, not the live buffer', () => {
    const log = createDiagnosticsLog(3)
    log.append('info', 'a')
    const first = log.snapshot()
    log.append('info', 'b')
    expect(first).toHaveLength(1)
  })
})

describe(describeError, () => {
  it('extracts the message from Error instances', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
  })

  it('stringifies non-Error values', () => {
    expect(describeError('raw failure')).toBe('raw failure')
    expect(describeError(42)).toBe('42')
  })
})
