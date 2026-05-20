import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildDayTicks,
  computeBalanceHistory,
  extractTimestampMs,
  filterByTimeRange
} from '../../src/utils/balance-history'
import type { OnchainTxEntry } from '../../src/utils/movements-feed'
import { createMovement } from '../fixtures/movements'

function makeOnchainEntry(overrides: Partial<OnchainTxEntry> = {}): OnchainTxEntry {
  return {
    amountSat: 0,
    approximateTimestampMs: 0,
    bindingAddress: undefined,
    confirmationHeight: null,
    direction: 'incoming',
    kind: 'onchain',
    status: 'successful',
    txid: 'tx',
    ...overrides
  }
}

describe(computeBalanceHistory, () => {
  it('returns an empty array when there are no events', () => {
    expect(computeBalanceHistory([], [], 10_000)).toStrictEqual([])
  })

  it('filters out non-successful movements', () => {
    const failed = createMovement({
      effectiveBalanceSat: 1000,
      status: 'failed',
      time: {
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01')
      }
    })
    expect(computeBalanceHistory([failed], [], 0)).toStrictEqual([])
  })

  it('produces a running balance ending at the endpoint total', () => {
    const m1 = createMovement({
      effectiveBalanceSat: 100,
      id: 1,
      time: { createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') }
    })
    const m2 = createMovement({
      effectiveBalanceSat: -25,
      id: 2,
      time: { createdAt: new Date('2026-01-02'), updatedAt: new Date('2026-01-02') }
    })
    const result = computeBalanceHistory([m1, m2], [], 75)
    expect(result).toHaveLength(2)
    expect(result.at(-1)?.balanceSat).toBe(75)
    expect(result.at(0)?.balanceSat).toBe(100)
  })

  it('merges onchain entries and sorts by time ascending', () => {
    const movement = createMovement({
      effectiveBalanceSat: 500,
      time: { createdAt: new Date('2026-01-02'), updatedAt: new Date('2026-01-02') }
    })
    const onchain = makeOnchainEntry({
      amountSat: 200,
      approximateTimestampMs: new Date('2026-01-01').getTime()
    })
    const result = computeBalanceHistory([movement], [onchain], 700)
    expect(result).toHaveLength(2)
    expect(result[0].timestampMs).toBeLessThan(result[1].timestampMs)
    expect(result[0].balanceSat).toBe(200)
    expect(result[1].balanceSat).toBe(700)
  })
})

describe(filterByTimeRange, () => {
  const NOW = new Date('2026-05-13T00:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty for empty input', () => {
    expect(filterByTimeRange([], '7d')).toStrictEqual([])
  })

  it('keeps points within the 7d window', () => {
    const within = { balanceSat: 1, timestampMs: new Date('2026-05-10T00:00:00Z').getTime() }
    const outside = { balanceSat: 2, timestampMs: new Date('2026-05-01T00:00:00Z').getTime() }
    expect(filterByTimeRange([within, outside], '7d')).toStrictEqual([within])
  })

  it('keeps points within the 30d window', () => {
    const within = { balanceSat: 1, timestampMs: new Date('2026-04-20T00:00:00Z').getTime() }
    const outside = { balanceSat: 2, timestampMs: new Date('2026-03-01T00:00:00Z').getTime() }
    expect(filterByTimeRange([within, outside], '30d')).toStrictEqual([within])
  })

  it('defaults to a 90d window', () => {
    const within = { balanceSat: 1, timestampMs: new Date('2026-03-15T00:00:00Z').getTime() }
    const outside = { balanceSat: 2, timestampMs: new Date('2025-12-01T00:00:00Z').getTime() }
    expect(filterByTimeRange([within, outside], 'unknown')).toStrictEqual([within])
  })
})

describe(computeBalanceHistory, () => {
  it('filters out non-successful onchain entries', () => {
    const failed = makeOnchainEntry({ amountSat: 500, status: 'pending' })
    expect(computeBalanceHistory([], [failed], 0)).toStrictEqual([])
  })
})

describe(extractTimestampMs, () => {
  it('returns undefined for non-objects', () => {
    expect(extractTimestampMs(null)).toBeUndefined()
    expect(extractTimestampMs('a')).toBeUndefined()
    expect(extractTimestampMs(42)).toBeUndefined()
    expect(extractTimestampMs(true)).toBeUndefined()
  })

  it('returns undefined when timestampMs is missing', () => {
    expect(extractTimestampMs({})).toBeUndefined()
  })

  it('returns undefined when timestampMs is not a number', () => {
    expect(extractTimestampMs({ timestampMs: '123' })).toBeUndefined()
  })

  it('returns the numeric timestampMs', () => {
    expect(extractTimestampMs({ timestampMs: 1700 })).toBe(1700)
  })
})

describe(buildDayTicks, () => {
  it('returns empty when end <= start', () => {
    expect(buildDayTicks(1000, 1000)).toStrictEqual([])
    expect(buildDayTicks(2000, 1000)).toStrictEqual([])
  })

  it('produces ascending ticks within range', () => {
    const start = new Date('2026-01-01T00:00:00').getTime()
    const end = new Date('2026-01-04T00:00:00').getTime()
    const ticks = buildDayTicks(start, end)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks[0]).toBeGreaterThanOrEqual(start)
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1])
    }
    expect(ticks.at(-1)).toBeLessThanOrEqual(end)
  })

  it('grows the step when the range spans many days', () => {
    const start = new Date('2026-01-01T00:00:00').getTime()
    const end = new Date('2026-04-01T00:00:00').getTime()
    const ticks = buildDayTicks(start, end)
    // step = ceil(rangeDays / 8) → ticks count ≤ rangeDays / step ≈ 8 + some slack
    expect(ticks.length).toBeLessThanOrEqual(20)
    expect(ticks.length).toBeGreaterThan(0)
  })
})
