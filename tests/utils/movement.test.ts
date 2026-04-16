import type { Movement } from '@secondts/barkd'
import { describe, expect, it } from 'vitest'
import { getMovementCounterparty, getMovementDirection } from '../../src/utils/movement'

const BASE_MOVEMENT: Movement = {
  effectiveBalanceSat: 0,
  exitedVtxos: [],
  id: 1,
  inputVtxos: [],
  intendedBalanceSat: 0,
  offchainFeeSat: 0,
  outputVtxos: [],
  receivedOn: [],
  sentTo: [],
  status: 'successful',
  subsystem: { kind: 'ark', name: 'Ark' },
  time: { createdAt: new Date(), updatedAt: new Date() }
}

function createMovement(overrides: Partial<Movement>): Movement {
  return { ...BASE_MOVEMENT, ...overrides }
}

describe(getMovementDirection, () => {
  it('returns incoming for positive balance', () => {
    const movement = createMovement({ effectiveBalanceSat: 50_000 })
    expect(getMovementDirection(movement)).toBe('incoming')
  })

  it('returns incoming for zero balance', () => {
    const movement = createMovement({ effectiveBalanceSat: 0 })
    expect(getMovementDirection(movement)).toBe('incoming')
  })

  it('returns outgoing for negative balance', () => {
    const movement = createMovement({ effectiveBalanceSat: -10_000 })
    expect(getMovementDirection(movement)).toBe('outgoing')
  })
})

describe(getMovementCounterparty, () => {
  it('returns formatted sentTo address for outgoing movement', () => {
    const movement = createMovement({
      effectiveBalanceSat: -50_000,
      sentTo: [
        {
          amountSat: 50_000,
          destination: { type: 'bitcoin', value: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' }
        }
      ]
    })
    expect(getMovementCounterparty(movement)).toBe('bc1qar0...zwf5mdq')
  })

  it('returns formatted receivedOn address for incoming movement', () => {
    const movement = createMovement({
      effectiveBalanceSat: 50_000,
      receivedOn: [
        {
          amountSat: 50_000,
          destination: { type: 'invoice', value: 'lnbc1pvjluezpp5qqqsyqcyq5rqwzqf' }
        }
      ]
    })
    expect(getMovementCounterparty(movement)).toBe('lnbc1pv...5rqwzqf')
  })

  it('returns subsystem name when outgoing has no sentTo', () => {
    const movement = createMovement({
      effectiveBalanceSat: -10_000,
      sentTo: [],
      subsystem: { kind: 'lightning', name: 'Lightning' }
    })
    expect(getMovementCounterparty(movement)).toBe('Lightning')
  })

  it('returns subsystem name when incoming has no receivedOn', () => {
    const movement = createMovement({
      effectiveBalanceSat: 10_000,
      receivedOn: [],
      subsystem: { kind: 'ark', name: 'Ark' }
    })
    expect(getMovementCounterparty(movement)).toBe('Ark')
  })
})
