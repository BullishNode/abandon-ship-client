import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAnnotation,
  buildOnchainAnnotation,
  dedupeNonEmpty,
  movementDestinationValues,
  movementDirection
} from '../../src/utils/metadata'
import { createMovement } from '../fixtures/movements'

describe(dedupeNonEmpty, () => {
  it('removes empty strings and duplicates while preserving order', () => {
    expect(dedupeNonEmpty(['a', '', 'b', 'a', 'c'])).toStrictEqual(['a', 'b', 'c'])
  })

  it('returns an empty array for fully empty input', () => {
    expect(dedupeNonEmpty(['', ''])).toStrictEqual([])
  })

  it('keeps a single value', () => {
    expect(dedupeNonEmpty(['foo'])).toStrictEqual(['foo'])
  })
})

describe(movementDirection, () => {
  it('returns incoming for positive balance', () => {
    expect(movementDirection(createMovement({ effectiveBalanceSat: 100 }))).toBe('incoming')
  })

  it('returns outgoing for negative balance', () => {
    expect(movementDirection(createMovement({ effectiveBalanceSat: -100 }))).toBe('outgoing')
  })

  it('returns null on zero balance', () => {
    expect(movementDirection(createMovement({ effectiveBalanceSat: 0 }))).toBeNull()
  })
})

describe(movementDestinationValues, () => {
  it('returns receivedOn values for incoming direction', () => {
    const movement = createMovement({
      receivedOn: [
        { amountSat: 10, destination: { type: 'bitcoin', value: 'bc1q...a' } },
        { amountSat: 5, destination: { type: 'bitcoin', value: '' } }
      ]
    })
    expect(movementDestinationValues(movement, 'incoming')).toStrictEqual(['bc1q...a'])
  })

  it('returns sentTo values for outgoing direction', () => {
    const movement = createMovement({
      sentTo: [{ amountSat: 10, destination: { type: 'invoice', value: 'lnbc1...' } }]
    })
    expect(movementDestinationValues(movement, 'outgoing')).toStrictEqual(['lnbc1...'])
  })
})

describe(buildAnnotation, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-13T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('trims the label', () => {
    const result = buildAnnotation(1, 'manual', { label: '  hello  ', tags: ['a'] })
    expect(result.label).toBe('hello')
  })

  it('drops empty labels', () => {
    const result = buildAnnotation(1, 'manual', { label: '   ', tags: [] })
    expect(result.label).toBeUndefined()
  })

  it('records the source and movement id', () => {
    const result = buildAnnotation(42, 'binding', { tags: [] })
    expect(result.source).toBe('binding')
    expect(result.movementId).toBe(42)
  })

  it('records the ISO timestamp for now', () => {
    const result = buildAnnotation(1, 'manual', { tags: [] })
    expect(result.createdAt).toBe('2026-05-13T00:00:00.000Z')
  })
})

describe(buildOnchainAnnotation, () => {
  it('builds an annotation with the txid', () => {
    const result = buildOnchainAnnotation('abc', { tags: ['x'] })
    expect(result.txid).toBe('abc')
    expect(result.tags).toStrictEqual(['x'])
  })

  it('omits an empty label', () => {
    const result = buildOnchainAnnotation('abc', { label: '   ', tags: [] })
    expect(result.label).toBeUndefined()
  })

  it('keeps a non-empty trimmed label', () => {
    const result = buildOnchainAnnotation('tx:0', { label: '  note  ', tags: [] })
    expect(result.label).toBe('note')
  })
})
