import { describe, expect, it } from 'vitest'
import {
  getMovementCounterparty,
  getMovementDirection,
  getMovementFeeSat,
  getMovementSource
} from '../../src/utils/movement'
import { createMovement } from '../fixtures/movements'

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

describe(getMovementSource, () => {
  it('returns ark when a destination has type ark', () => {
    const movement = createMovement({
      sentTo: [{ amountSat: 1, destination: { type: 'ark', value: 'ark1abc' } }]
    })
    expect(getMovementSource(movement)).toBe('ark')
  })

  it('returns onchain when a destination has type bitcoin', () => {
    const movement = createMovement({
      sentTo: [{ amountSat: 1, destination: { type: 'bitcoin', value: 'bc1qabc' } }]
    })
    expect(getMovementSource(movement)).toBe('onchain')
  })

  it('returns onchain when a destination has type output-script', () => {
    const movement = createMovement({
      sentTo: [{ amountSat: 1, destination: { type: 'output-script', value: '00' } }]
    })
    expect(getMovementSource(movement)).toBe('onchain')
  })

  it('returns lightning for invoice/offer/lightning-address destinations', () => {
    const invoice = createMovement({
      sentTo: [{ amountSat: 1, destination: { type: 'invoice', value: 'lnbc1' } }]
    })
    const offer = createMovement({
      sentTo: [{ amountSat: 1, destination: { type: 'offer', value: 'lno1' } }]
    })
    const lnaddr = createMovement({
      sentTo: [{ amountSat: 1, destination: { type: 'lightning-address', value: 'a@b' } }]
    })
    expect(getMovementSource(invoice)).toBe('lightning')
    expect(getMovementSource(offer)).toBe('lightning')
    expect(getMovementSource(lnaddr)).toBe('lightning')
  })

  it('falls back to subsystem name when destinations are absent or custom', () => {
    const ln = createMovement({ subsystem: { kind: 'lightning', name: 'Lightning' } })
    const onchain = createMovement({ subsystem: { kind: 'onchain', name: 'on-chain wallet' } })
    const ark = createMovement({ subsystem: { kind: 'ark', name: 'Ark' } })
    expect(getMovementSource(ln)).toBe('lightning')
    expect(getMovementSource(onchain)).toBe('onchain')
    expect(getMovementSource(ark)).toBe('ark')
  })

  it('matches subsystem name "ln" as lightning', () => {
    const movement = createMovement({ subsystem: { kind: 'lightning', name: 'ln' } })
    expect(getMovementSource(movement)).toBe('lightning')
  })

  it('returns unknown when nothing matches', () => {
    const movement = createMovement({ subsystem: { kind: 'custom', name: 'mystery' } })
    expect(getMovementSource(movement)).toBe('unknown')
  })

  it('prefers destination type over subsystem name', () => {
    const movement = createMovement({
      receivedOn: [{ amountSat: 1, destination: { type: 'invoice', value: 'lnbc' } }],
      subsystem: { kind: 'ark', name: 'Ark' }
    })
    expect(getMovementSource(movement)).toBe('lightning')
  })

  it('classifies bark.offboard as ark even with bitcoin destination', () => {
    const movement = createMovement({
      sentTo: [{ amountSat: 5000, destination: { type: 'bitcoin', value: 'tb1p9lwzpy' } }],
      subsystem: { kind: 'send_onchain', name: 'bark.offboard' }
    })
    expect(getMovementSource(movement)).toBe('ark')
  })

  it('classifies bark.exit as exit even with bitcoin destination', () => {
    const movement = createMovement({
      sentTo: [{ amountSat: 5000, destination: { type: 'bitcoin', value: 'tb1p9lwzpy' } }],
      subsystem: { kind: 'exit', name: 'bark.exit' }
    })
    expect(getMovementSource(movement)).toBe('exit')
  })
})

describe(getMovementFeeSat, () => {
  it('returns the offchainFeeSat when present', () => {
    expect(getMovementFeeSat(createMovement({ offchainFeeSat: 250 }))).toBe(250)
  })

  it('returns zero when fee is zero', () => {
    expect(getMovementFeeSat(createMovement({ offchainFeeSat: 0 }))).toBe(0)
  })
})
