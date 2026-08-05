import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BarkWebMovementMetadata, DestinationBinding } from '../../src/types/metadata'
import {
  applyBindingPromotions,
  buildMovementMetadataPatchBody,
  buildOnchainAnnotation,
  computeBindingPromotions,
  dedupeNonEmpty,
  getMovementMetadata,
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
    expect(movementDirection(createMovement({ effectiveBalanceSats: 100 }))).toBe('incoming')
  })

  it('returns outgoing for negative balance', () => {
    expect(movementDirection(createMovement({ effectiveBalanceSats: -100 }))).toBe('outgoing')
  })

  it('returns null on zero balance', () => {
    expect(movementDirection(createMovement({ effectiveBalanceSats: 0 }))).toBeNull()
  })
})

describe(movementDestinationValues, () => {
  it('returns receivedOn values for incoming direction', () => {
    const movement = createMovement({
      receivedOn: [
        { amountSats: 10, paymentType: 'bitcoin', value: 'bc1q...a' },
        { amountSats: 5, paymentType: 'bitcoin', value: '' }
      ]
    })
    expect(movementDestinationValues(movement, 'incoming')).toStrictEqual(['bc1q...a'])
  })

  it('returns sentTo values for outgoing direction', () => {
    const movement = createMovement({
      sentTo: [{ amountSats: 10, paymentType: 'invoice', value: 'lnbc1...' }]
    })
    expect(movementDestinationValues(movement, 'outgoing')).toStrictEqual(['lnbc1...'])
  })
})

describe(getMovementMetadata, () => {
  it('returns undefined when metadata is missing', () => {
    expect(getMovementMetadata(createMovement())).toBeUndefined()
  })

  it('returns undefined when the bark-web key is missing', () => {
    expect(getMovementMetadata(createMovement({ metadata: { other: 'x' } }))).toBeUndefined()
  })

  it('returns undefined when the bark-web value is not an object', () => {
    expect(
      getMovementMetadata(createMovement({ metadata: { 'bark-web': 'not-object' } }))
    ).toBeUndefined()
  })

  it('parses label, tags, contactId, updatedAt', () => {
    const result = getMovementMetadata(
      createMovement({
        metadata: {
          'bark-web': {
            contactId: 'c1',
            label: 'coffee',
            tags: ['food', 'coffee'],
            updatedAt: '2026-05-28T00:00:00.000Z'
          }
        }
      })
    )
    expect(result).toStrictEqual({
      contactId: 'c1',
      label: 'coffee',
      tags: ['food', 'coffee'],
      updatedAt: '2026-05-28T00:00:00.000Z'
    })
  })

  it('drops fields with wrong types and non-string tag entries', () => {
    const result = getMovementMetadata(
      createMovement({
        metadata: {
          'bark-web': {
            contactId: 42,
            label: 7,
            tags: ['ok', 1, null, 'also-ok']
          }
        }
      })
    )
    expect(result).toStrictEqual({ tags: ['ok', 'also-ok'] })
  })
})

describe(buildMovementMetadataPatchBody, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('wraps fields under the bark-web namespace', () => {
    const body = buildMovementMetadataPatchBody({ label: 'note', tags: ['t1'] })
    expect(body).toStrictEqual({
      'bark-web': {
        label: 'note',
        tags: ['t1'],
        updatedAt: '2026-05-28T00:00:00.000Z'
      }
    })
  })

  it('sends null for fields explicitly set to null to clear them', () => {
    const body = buildMovementMetadataPatchBody({ contactId: null, label: null })
    expect(body).toStrictEqual({
      'bark-web': {
        contactId: null,
        label: null,
        updatedAt: '2026-05-28T00:00:00.000Z'
      }
    })
  })

  it('omits fields that are not included in the patch', () => {
    const inner = buildMovementMetadataPatchBody({ tags: ['x'] })['bark-web']
    expect(inner).not.toHaveProperty('label')
    expect(inner).not.toHaveProperty('contactId')
    expect(inner).toHaveProperty('tags', ['x'])
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

function makeBinding(overrides: Partial<DestinationBinding> = {}): DestinationBinding {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    destinations: ['addr-a'],
    direction: 'incoming',
    id: 'b1',
    tags: [],
    ...overrides
  }
}

describe(computeBindingPromotions, () => {
  it('returns empty list when there are no bindings', () => {
    expect(
      computeBindingPromotions([createMovement({ effectiveBalanceSats: 100, id: 1 })], [])
    ).toStrictEqual([])
  })

  it('matches a movement that has no existing metadata', () => {
    const promotions = computeBindingPromotions(
      [
        createMovement({
          effectiveBalanceSats: 100,
          id: 1,
          receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-a' }]
        })
      ],
      [makeBinding({ label: 'coffee' })]
    )
    expect(promotions).toHaveLength(1)
    expect(promotions[0]).toMatchObject({
      bindingId: 'b1',
      metadata: { label: 'coffee', tags: [] },
      movementId: 1
    })
  })

  it('skips movements that already carry bark-web metadata', () => {
    const promotions = computeBindingPromotions(
      [
        createMovement({
          effectiveBalanceSats: 100,
          id: 1,
          metadata: { 'bark-web': { label: 'existing' } },
          receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-a' }]
        })
      ],
      [makeBinding({ label: 'binding' })]
    )
    expect(promotions).toStrictEqual([])
  })

  it('does not match bindings of a different direction', () => {
    const promotions = computeBindingPromotions(
      [
        createMovement({
          effectiveBalanceSats: 100,
          id: 1,
          receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-a' }]
        })
      ],
      [makeBinding({ direction: 'outgoing' })]
    )
    expect(promotions).toStrictEqual([])
  })

  it('picks the newest binding when multiple match the same movement', () => {
    const promotions = computeBindingPromotions(
      [
        createMovement({
          effectiveBalanceSats: 100,
          id: 1,
          receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-a' }]
        })
      ],
      [
        makeBinding({
          createdAt: '2026-01-01T00:00:00.000Z',
          id: 'old',
          label: 'old-label'
        }),
        makeBinding({
          createdAt: '2026-05-01T00:00:00.000Z',
          id: 'new',
          label: 'new-label'
        })
      ]
    )
    expect(promotions[0]?.metadata.label).toBe('new-label')
    expect(promotions[0]?.bindingId).toBe('new')
  })

  it('consumes each binding at most once across movements', () => {
    const promotions = computeBindingPromotions(
      [
        createMovement({
          effectiveBalanceSats: 100,
          id: 1,
          receivedOn: [{ amountSats: 100, paymentType: 'bitcoin', value: 'addr-a' }]
        }),
        createMovement({
          effectiveBalanceSats: 50,
          id: 2,
          receivedOn: [{ amountSats: 50, paymentType: 'bitcoin', value: 'addr-a' }]
        })
      ],
      [makeBinding({ label: 'one-shot' })]
    )
    expect(promotions).toHaveLength(1)
    expect(promotions[0].movementId).toBe(1)
  })
})

describe(applyBindingPromotions, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the same array reference when there are no promotions', () => {
    const input = [createMovement({ id: 1 })]
    expect(applyBindingPromotions(input, [])).toBe(input)
  })

  it('writes promoted metadata under the bark-web key', () => {
    const movements = [createMovement({ id: 1 })]
    const promotedMetadata: BarkWebMovementMetadata = { label: 'coffee', tags: ['food'] }
    const result = applyBindingPromotions(movements, [
      { bindingId: 'b', metadata: promotedMetadata, movementId: 1 }
    ])
    const stored = getMovementMetadata(result[0])
    expect(stored).toStrictEqual({
      label: 'coffee',
      tags: ['food'],
      updatedAt: '2026-05-28T00:00:00.000Z'
    })
  })
})
