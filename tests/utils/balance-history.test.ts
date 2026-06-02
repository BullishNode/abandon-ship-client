import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildChartSeries,
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
    feeSat: null,
    firstSeenMs: null,
    kind: 'onchain',
    status: 'successful',
    txid: 'tx',
    ...overrides
  }
}

describe(computeBalanceHistory, () => {
  it('returns no points and endpoint as initial balance when there are no events', () => {
    const result = computeBalanceHistory([], [], 10_000)
    expect(result.points).toStrictEqual([])
    expect(result.initialBalanceSat).toBe(10_000)
  })

  it('filters out failed and canceled movements', () => {
    const failed = createMovement({
      effectiveBalanceSat: 1000,
      id: 1,
      status: 'failed',
      time: { createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') }
    })
    const canceled = createMovement({
      effectiveBalanceSat: 1000,
      id: 2,
      status: 'canceled',
      time: { createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') }
    })
    expect(computeBalanceHistory([failed, canceled], [], 0).points).toStrictEqual([])
  })

  it('keeps pending movements so pending board sats are not absorbed into the initial balance', () => {
    const received = createMovement({
      effectiveBalanceSat: 30_000,
      id: 1,
      status: 'successful',
      time: {
        createdAt: new Date('2026-06-02T11:48:43Z'),
        updatedAt: new Date('2026-06-02T11:48:44Z')
      }
    })
    const pendingBoard = createMovement({
      effectiveBalanceSat: 10_000,
      id: 2,
      status: 'pending',
      time: {
        createdAt: new Date('2026-06-02T12:07:52Z'),
        updatedAt: new Date('2026-06-02T12:07:52Z')
      }
    })
    const result = computeBalanceHistory([received, pendingBoard], [], 40_000)
    expect(result.initialBalanceSat).toBe(0)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([30_000, 40_000])
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
    expect(result.points).toHaveLength(2)
    expect(result.points.at(-1)?.balanceSat).toBe(75)
    expect(result.points.at(0)?.balanceSat).toBe(100)
    expect(result.initialBalanceSat).toBe(0)
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
    expect(result.points).toHaveLength(2)
    expect(result.points[0].timestampMs).toBeLessThan(result.points[1].timestampMs)
    expect(result.points[0].balanceSat).toBe(200)
    expect(result.points[1].balanceSat).toBe(700)
    expect(result.initialBalanceSat).toBe(0)
  })

  it('includes pending onchain entries so they are not absorbed into the initial balance', () => {
    const pending = makeOnchainEntry({
      amountSat: 500,
      approximateTimestampMs: new Date('2026-01-01').getTime(),
      status: 'pending'
    })
    const result = computeBalanceHistory([], [pending], 500)
    expect(result.points).toHaveLength(1)
    expect(result.points[0].balanceSat).toBe(500)
    expect(result.initialBalanceSat).toBe(0)
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
    expect(ticks.length).toBeLessThanOrEqual(20)
    expect(ticks.length).toBeGreaterThan(0)
  })
})

describe(buildChartSeries, () => {
  const NOW = new Date('2026-05-13T00:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('spans full window with synthetic start and end when only same-day points exist', () => {
    const sameDay = new Date('2026-05-12T10:00:00Z').getTime()
    const history = {
      initialBalanceSat: 0,
      points: [
        { balanceSat: 10_000, timestampMs: sameDay },
        { balanceSat: 20_000, timestampMs: sameDay + 60_000 }
      ]
    }
    const series = buildChartSeries(history, '90d', 20_000)
    expect(series.domainEndMs).toBe(NOW.getTime())
    expect(series.domainStartMs).toBe(NOW.getTime() - 90 * 24 * 60 * 60 * 1000)
    expect(series.data.at(0)).toStrictEqual({
      balanceSat: 0,
      timestampMs: series.domainStartMs
    })
    expect(series.data.at(-1)).toStrictEqual({
      balanceSat: 20_000,
      timestampMs: series.domainEndMs
    })
    expect(series.ticks.length).toBeGreaterThan(0)
  })

  it('uses last pre-window point balance as the starting balance', () => {
    const prior = new Date('2026-01-01T00:00:00Z').getTime()
    const within = new Date('2026-05-10T00:00:00Z').getTime()
    const history = {
      initialBalanceSat: 0,
      points: [
        { balanceSat: 5000, timestampMs: prior },
        { balanceSat: 7500, timestampMs: within }
      ]
    }
    const series = buildChartSeries(history, '7d', 7500)
    expect(series.data.at(0)?.balanceSat).toBe(5000)
    expect(series.data.at(0)?.timestampMs).toBe(series.domainStartMs)
    expect(series.data.at(-1)?.balanceSat).toBe(7500)
  })

  it('returns flat series at endpoint when there are no points', () => {
    const series = buildChartSeries({ initialBalanceSat: 1234, points: [] }, '30d', 1234)
    expect(series.data).toStrictEqual([
      { balanceSat: 1234, timestampMs: series.domainStartMs },
      { balanceSat: 1234, timestampMs: series.domainEndMs }
    ])
  })
})
