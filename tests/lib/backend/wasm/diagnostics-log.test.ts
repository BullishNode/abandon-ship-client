import { describe, expect, it } from 'vitest'
import { createDiagnosticsLog, describeError } from '@/lib/backend/wasm/diagnostics-log'

function messageOf(entry: string): string | undefined {
  return entry.split('] ')[1]
}

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
    const messages = log.snapshot().map(messageOf)
    expect(messages).toStrictEqual(['a', 'b'])
  })

  it('evicts the oldest entries once capacity is reached', () => {
    const log = createDiagnosticsLog(3)
    for (const message of ['a', 'b', 'c', 'd', 'e']) {
      log.append('info', message)
    }
    const messages = log.snapshot().map(messageOf)
    expect(messages).toStrictEqual(['c', 'd', 'e'])
  })

  it('returns a copy, not the live buffer', () => {
    const log = createDiagnosticsLog(3)
    log.append('info', 'a')
    const first = log.snapshot()
    log.append('info', 'b')
    expect(first).toHaveLength(1)
  })

  it('drains entries appended since the last drain', () => {
    const log = createDiagnosticsLog(3)
    log.append('info', 'a')
    expect(log.drain().map(messageOf)).toStrictEqual(['a'])
    log.append('info', 'b')
    expect(log.drain().map(messageOf)).toStrictEqual(['b'])
  })

  it('drains empty when nothing was appended', () => {
    const log = createDiagnosticsLog(3)
    expect(log.drain()).toStrictEqual([])
    log.append('info', 'a')
    log.drain()
    expect(log.drain()).toStrictEqual([])
  })

  // The ring evicts to stay bounded; a drain must still hand over every entry so
  // persistence keeps history the in-memory buffer can no longer show.
  it('drains entries the ring buffer has already evicted', () => {
    const log = createDiagnosticsLog(2)
    for (const message of ['a', 'b', 'c']) {
      log.append('info', message)
    }
    expect(log.drain().map(messageOf)).toStrictEqual(['a', 'b', 'c'])
    expect(log.snapshot().map(messageOf)).toStrictEqual(['b', 'c'])
  })

  it('keeps draining independent of snapshot, so the export stays complete', () => {
    const log = createDiagnosticsLog(3)
    log.append('info', 'a')
    log.drain()
    expect(log.snapshot().map(messageOf)).toStrictEqual(['a'])
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

  // Every logged error routes through here, so redaction has to apply at this
  // seam rather than at each call site.
  it('redacts an address echoed back inside an error message', () => {
    const address = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
    expect(describeError(new Error(`Failed to parse address ${address}`))).not.toContain(address)
  })

  it('redacts a secret carried by a thrown non-Error value', () => {
    const invoice = `lnbc1${'q'.repeat(200)}`
    expect(describeError(invoice)).not.toContain(invoice)
  })
})
