import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildChartSeries,
  buildTicks,
  computeBalanceHistory,
  computeWindow,
  extractTimestampMs,
  toChartTimeframe
} from '../../src/utils/balance-history'
import type { OnchainTxEntry } from '../../src/utils/movements-feed'
import { createMovement, destination } from '../fixtures/movements'

function makeOnchainEntry(overrides: Partial<OnchainTxEntry> = {}): OnchainTxEntry {
  return {
    amountSat: 0,
    approximateTimestampMs: 0,
    bindingAddress: undefined,
    confirmationHeight: null,
    direction: 'incoming',
    feeSat: null,
    firstSeenMs: null,
    isBoard: false,
    isCpfp: false,
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
      createdAt: new Date('2026-01-01').toISOString(),
      effectiveBalanceSats: 1000,
      id: 1,
      status: 'failed',
      updatedAt: new Date('2026-01-01').toISOString()
    })
    const canceled = createMovement({
      createdAt: new Date('2026-01-01').toISOString(),
      effectiveBalanceSats: 1000,
      id: 2,
      status: 'canceled',
      updatedAt: new Date('2026-01-01').toISOString()
    })
    expect(computeBalanceHistory([failed, canceled], [], 0).points).toStrictEqual([])
  })

  it('keeps pending movements so pending board sats are not absorbed into the initial balance', () => {
    const received = createMovement({
      createdAt: new Date('2026-06-02T11:48:43Z').toISOString(),
      effectiveBalanceSats: 30_000,
      id: 1,
      status: 'successful',
      updatedAt: new Date('2026-06-02T11:48:44Z').toISOString()
    })
    const pendingBoard = createMovement({
      createdAt: new Date('2026-06-02T12:07:52Z').toISOString(),
      effectiveBalanceSats: 10_000,
      id: 2,
      status: 'pending',
      updatedAt: new Date('2026-06-02T12:07:52Z').toISOString()
    })
    const result = computeBalanceHistory([received, pendingBoard], [], 40_000)
    expect(result.initialBalanceSat).toBe(0)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([30_000, 40_000])
  })

  it('produces a running balance ending at the endpoint total', () => {
    const m1 = createMovement({
      createdAt: new Date('2026-01-01').toISOString(),
      effectiveBalanceSats: 100,
      id: 1,
      updatedAt: new Date('2026-01-01').toISOString()
    })
    const m2 = createMovement({
      createdAt: new Date('2026-01-02').toISOString(),
      effectiveBalanceSats: -25,
      id: 2,
      updatedAt: new Date('2026-01-02').toISOString()
    })
    const result = computeBalanceHistory([m1, m2], [], 75)
    expect(result.points).toHaveLength(2)
    expect(result.points.at(-1)?.balanceSat).toBe(75)
    expect(result.points.at(0)?.balanceSat).toBe(100)
    expect(result.initialBalanceSat).toBe(0)
  })

  it('merges onchain entries and sorts by time ascending', () => {
    const movement = createMovement({
      createdAt: new Date('2026-01-02').toISOString(),
      effectiveBalanceSats: 500,
      updatedAt: new Date('2026-01-02').toISOString()
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

  it('collapses an exit and its on-chain landing into a single fee-only step', () => {
    const received = createMovement({
      createdAt: new Date('2026-06-16T00:00:00Z').toISOString(),
      effectiveBalanceSats: 10_000,
      id: 1,
      updatedAt: new Date('2026-06-16T00:00:00Z').toISOString()
    })
    const exit = createMovement({
      createdAt: new Date('2026-06-17T00:00:00Z').toISOString(),
      effectiveBalanceSats: -10_000,
      id: 2,
      sentTo: [destination('bitcoin', 'bc1pexit', 10_000)],
      subsystem: { kind: 'start', name: 'bark.exit' },
      updatedAt: new Date('2026-06-17T00:00:00Z').toISOString()
    })
    const landing = makeOnchainEntry({
      amountSat: 9800,
      approximateTimestampMs: new Date('2026-06-18T00:00:00Z').getTime(),
      bindingAddress: 'bc1pexit',
      direction: 'incoming',
      txid: 'landing'
    })
    const result = computeBalanceHistory([received, exit], [landing], 9800)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([10_000, 9800])
    expect(Math.max(...result.points.map((point) => point.balanceSat))).toBe(10_000)
  })

  it('collapses a cooperative offboard and its landing into a single fee-only step', () => {
    const received = createMovement({
      createdAt: new Date('2026-06-16T00:00:00Z').toISOString(),
      effectiveBalanceSats: 10_000,
      id: 1,
      updatedAt: new Date('2026-06-16T00:00:00Z').toISOString()
    })
    const offboard = createMovement({
      createdAt: new Date('2026-06-17T00:00:00Z').toISOString(),
      effectiveBalanceSats: -10_000,
      id: 2,
      sentTo: [destination('bitcoin', 'bc1poffboard', 10_000)],
      subsystem: { kind: 'send_onchain', name: 'bark.offboard' },
      updatedAt: new Date('2026-06-17T00:00:00Z').toISOString()
    })
    const landing = makeOnchainEntry({
      amountSat: 9800,
      approximateTimestampMs: new Date('2026-06-18T00:00:00Z').getTime(),
      bindingAddress: 'bc1poffboard',
      direction: 'incoming',
      txid: 'landing'
    })
    const result = computeBalanceHistory([received, offboard], [landing], 9800)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([10_000, 9800])
    expect(Math.max(...result.points.map((point) => point.balanceSat))).toBe(10_000)
  })

  it('collapses a round-based offboard (bark.round/send_onchain) and its landing', () => {
    const offboard = createMovement({
      createdAt: new Date('2026-06-17T00:00:00Z').toISOString(),
      effectiveBalanceSats: -10_000,
      id: 1,
      sentTo: [destination('bitcoin', 'bc1pround', 10_000)],
      subsystem: { kind: 'send_onchain', name: 'bark.round' },
      updatedAt: new Date('2026-06-17T00:00:00Z').toISOString()
    })
    const landing = makeOnchainEntry({
      amountSat: 9800,
      approximateTimestampMs: new Date('2026-06-18T00:00:00Z').getTime(),
      bindingAddress: 'bc1pround',
      direction: 'incoming',
      txid: 'landing'
    })
    const result = computeBalanceHistory([offboard], [landing], -200)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([-200])
  })

  it('leaves an unmatched exit as a normal debit so a pending exit still dips', () => {
    const received = createMovement({
      createdAt: new Date('2026-06-16T00:00:00Z').toISOString(),
      effectiveBalanceSats: 10_000,
      id: 1,
      updatedAt: new Date('2026-06-16T00:00:00Z').toISOString()
    })
    const exit = createMovement({
      createdAt: new Date('2026-06-17T00:00:00Z').toISOString(),
      effectiveBalanceSats: -10_000,
      id: 2,
      sentTo: [destination('bitcoin', 'bc1pexit', 10_000)],
      subsystem: { kind: 'start', name: 'bark.exit' },
      updatedAt: new Date('2026-06-17T00:00:00Z').toISOString()
    })
    const result = computeBalanceHistory([received, exit], [], 0)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([10_000, 0])
  })

  it('does not collapse a failed exit, leaving its landing as an independent credit', () => {
    const exit = createMovement({
      createdAt: new Date('2026-06-17T00:00:00Z').toISOString(),
      effectiveBalanceSats: -10_000,
      id: 1,
      sentTo: [destination('bitcoin', 'bc1pexit', 10_000)],
      status: 'failed',
      subsystem: { kind: 'start', name: 'bark.exit' },
      updatedAt: new Date('2026-06-17T00:00:00Z').toISOString()
    })
    const landing = makeOnchainEntry({
      amountSat: 9800,
      approximateTimestampMs: new Date('2026-06-18T00:00:00Z').getTime(),
      bindingAddress: 'bc1pexit',
      direction: 'incoming',
      txid: 'landing'
    })
    const result = computeBalanceHistory([exit], [landing], 9800)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([9800])
  })

  it('does not pair an exit without a destination address', () => {
    const exit = createMovement({
      createdAt: new Date('2026-06-17T00:00:00Z').toISOString(),
      effectiveBalanceSats: -10_000,
      id: 1,
      sentTo: [],
      subsystem: { kind: 'start', name: 'bark.exit' },
      updatedAt: new Date('2026-06-17T00:00:00Z').toISOString()
    })
    const orphanCredit = makeOnchainEntry({
      amountSat: 9800,
      approximateTimestampMs: new Date('2026-06-18T00:00:00Z').getTime(),
      bindingAddress: undefined,
      direction: 'incoming',
      txid: 'credit'
    })
    const result = computeBalanceHistory([exit], [orphanCredit], -200)
    expect(result.points).toHaveLength(2)
    expect(result.points.at(-1)?.balanceSat).toBe(-200)
  })

  it('collapses a board and its funding tx so the balance never double-counts', () => {
    const receive = makeOnchainEntry({
      amountSat: 57_200,
      approximateTimestampMs: new Date('2026-08-01T10:00:00Z').getTime(),
      txid: 'receive'
    })
    const board = createMovement({
      createdAt: new Date('2026-08-01T11:00:00Z').toISOString(),
      effectiveBalanceSats: 57_000,
      id: 1,
      metadata: { chain_anchor: 'funding:0' },
      subsystem: { kind: 'board', name: 'bark.board' },
      updatedAt: new Date('2026-08-01T11:00:00Z').toISOString()
    })
    const funding = makeOnchainEntry({
      amountSat: -57_200,
      approximateTimestampMs: new Date('2026-08-01T11:00:45Z').getTime(),
      direction: 'outgoing',
      txid: 'funding'
    })
    const result = computeBalanceHistory([board], [receive, funding], 57_000)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([57_200, 57_000])
    expect(Math.max(...result.points.map((point) => point.balanceSat))).toBe(57_200)
  })

  it('matches the board funding tx through output VTXO IDs when chain_anchor is missing', () => {
    const board = createMovement({
      createdAt: new Date('2026-08-01T11:00:00Z').toISOString(),
      effectiveBalanceSats: 10_000,
      id: 1,
      outputVtxos: ['funding:1'],
      subsystem: { kind: 'board', name: 'bark.board' },
      updatedAt: new Date('2026-08-01T11:00:00Z').toISOString()
    })
    const funding = makeOnchainEntry({
      amountSat: -10_100,
      approximateTimestampMs: new Date('2026-08-01T11:00:45Z').getTime(),
      direction: 'outgoing',
      txid: 'funding'
    })
    const result = computeBalanceHistory([board], [funding], -100)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([-100])
  })

  it('does not collapse a failed board, leaving its funding tx as an independent debit', () => {
    const board = createMovement({
      createdAt: new Date('2026-08-01T11:00:00Z').toISOString(),
      effectiveBalanceSats: 10_000,
      id: 1,
      metadata: { chain_anchor: 'funding:0' },
      status: 'failed',
      subsystem: { kind: 'board', name: 'bark.board' },
      updatedAt: new Date('2026-08-01T11:00:00Z').toISOString()
    })
    const funding = makeOnchainEntry({
      amountSat: -10_100,
      approximateTimestampMs: new Date('2026-08-01T11:00:45Z').getTime(),
      direction: 'outgoing',
      txid: 'funding'
    })
    const result = computeBalanceHistory([board], [funding], -10_100)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([-10_100])
  })

  it('leaves a board without a visible funding tx as a normal credit', () => {
    const board = createMovement({
      createdAt: new Date('2026-08-01T11:00:00Z').toISOString(),
      effectiveBalanceSats: 10_000,
      id: 1,
      metadata: { chain_anchor: 'funding:0' },
      subsystem: { kind: 'board', name: 'bark.board' },
      updatedAt: new Date('2026-08-01T11:00:00Z').toISOString()
    })
    const result = computeBalanceHistory([board], [], 10_000)
    expect(result.points.map((point) => point.balanceSat)).toStrictEqual([10_000])
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

describe(computeWindow, () => {
  const NOW = new Date('2026-05-13T00:00:00Z')
  const DAY_MS = 24 * 60 * 60 * 1000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses a 1-day window when there are no points', () => {
    const { startMs, endMs } = computeWindow({ initialBalanceSat: 0, points: [] }, 'all')
    expect(endMs).toBe(NOW.getTime())
    expect(startMs).toBe(NOW.getTime() - DAY_MS)
  })

  it('clamps to a 1-day minimum for recent points', () => {
    const recent = new Date('2026-05-12T20:00:00Z').getTime()
    const { startMs } = computeWindow(
      {
        initialBalanceSat: 0,
        points: [{ balanceSat: 1, timestampMs: recent }]
      },
      'all'
    )
    expect(startMs).toBe(NOW.getTime() - DAY_MS)
  })

  it('grows the window to the oldest point', () => {
    const oldest = new Date('2026-05-03T00:00:00Z').getTime()
    const { startMs } = computeWindow(
      {
        initialBalanceSat: 0,
        points: [{ balanceSat: 1, timestampMs: oldest }]
      },
      'all'
    )
    expect(startMs).toBe(oldest)
  })

  it('spans the whole lifetime without a 90-day clamp for very old points', () => {
    const ancient = new Date('2025-01-01T00:00:00Z').getTime()
    const { startMs } = computeWindow(
      {
        initialBalanceSat: 0,
        points: [{ balanceSat: 1, timestampMs: ancient }]
      },
      'all'
    )
    expect(startMs).toBe(ancient)
  })

  it('uses a fixed window for explicit timeframes regardless of wallet age', () => {
    const ancient = new Date('2025-01-01T00:00:00Z').getTime()
    const history = {
      initialBalanceSat: 0,
      points: [{ balanceSat: 1, timestampMs: ancient }]
    }
    expect(computeWindow(history, '7d').startMs).toBe(NOW.getTime() - 7 * DAY_MS)
    expect(computeWindow(history, '30d').startMs).toBe(NOW.getTime() - 30 * DAY_MS)
    expect(computeWindow(history, '90d').startMs).toBe(NOW.getTime() - 90 * DAY_MS)
  })
})

describe(toChartTimeframe, () => {
  it('passes valid timeframes through', () => {
    expect(toChartTimeframe('7d')).toBe('7d')
    expect(toChartTimeframe('30d')).toBe('30d')
    expect(toChartTimeframe('90d')).toBe('90d')
    expect(toChartTimeframe('all')).toBe('all')
  })

  it('falls back to all for unknown values', () => {
    expect(toChartTimeframe('1y')).toBe('all')
    expect(toChartTimeframe('')).toBe('all')
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

describe(buildTicks, () => {
  it('returns empty when end <= start', () => {
    expect(buildTicks(1000, 1000).ticks).toStrictEqual([])
    expect(buildTicks(2000, 1000).ticks).toStrictEqual([])
  })

  it('produces ascending day-format ticks within range', () => {
    const start = new Date('2026-01-01T00:00:00').getTime()
    const end = new Date('2026-01-04T00:00:00').getTime()
    const { ticks, tickFormat } = buildTicks(start, end)
    expect(tickFormat).toBe('day')
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
    const { ticks } = buildTicks(start, end)
    expect(ticks.length).toBeLessThanOrEqual(20)
    expect(ticks.length).toBeGreaterThan(0)
  })

  it('uses hour-aligned ticks for windows of two days or less', () => {
    const start = new Date('2026-01-03T06:30:00').getTime()
    const end = new Date('2026-01-04T06:30:00').getTime()
    const { ticks, tickFormat } = buildTicks(start, end)
    expect(tickFormat).toBe('hour')
    expect(ticks.length).toBeGreaterThan(0)
    for (const tick of ticks) {
      expect(new Date(tick).getMinutes()).toBe(0)
      expect(tick).toBeGreaterThanOrEqual(start)
      expect(tick).toBeLessThanOrEqual(end)
    }
  })

  describe('across DST transitions', () => {
    const originalTz = process.env.TZ

    afterEach(() => {
      if (originalTz === undefined) {
        delete process.env.TZ
      } else {
        process.env.TZ = originalTz
      }
    })

    function expectLocalMidnights(startMs: number, endMs: number): void {
      const { ticks, tickFormat } = buildTicks(startMs, endMs)
      expect(tickFormat).toBe('day')
      expect(ticks.length).toBeGreaterThan(2)
      const seenDates = new Set<string>()
      for (const tick of ticks) {
        const date = new Date(tick)
        expect(date.getHours()).toBe(0)
        expect(date.getMinutes()).toBe(0)
        const label = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        expect(seenDates.has(label)).toBeFalsy()
        seenDates.add(label)
      }
    }

    it('keeps day ticks on local midnight across spring forward', () => {
      process.env.TZ = 'America/New_York'
      const start = new Date(2026, 2, 5).getTime()
      const end = new Date(2026, 2, 12).getTime()
      expectLocalMidnights(start, end)
    })

    it('keeps day ticks on local midnight across autumn fall back', () => {
      process.env.TZ = 'America/New_York'
      const start = new Date(2026, 9, 29).getTime()
      const end = new Date(2026, 10, 5).getTime()
      expectLocalMidnights(start, end)
    })
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
    const series = buildChartSeries(history, 20_000, 'all')
    expect(series.domainEndMs).toBe(NOW.getTime())
    expect(series.domainStartMs).toBe(NOW.getTime() - 24 * 60 * 60 * 1000)
    expect(series.tickFormat).toBe('hour')
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

  it('uses last pre-window point balance as the starting balance for a fixed timeframe', () => {
    const prior = new Date('2026-01-01T00:00:00Z').getTime()
    const within = new Date('2026-05-10T00:00:00Z').getTime()
    const history = {
      initialBalanceSat: 0,
      points: [
        { balanceSat: 5000, timestampMs: prior },
        { balanceSat: 7500, timestampMs: within }
      ]
    }
    const series = buildChartSeries(history, 7500, '90d')
    expect(series.data.at(0)?.balanceSat).toBe(5000)
    expect(series.data.at(0)?.timestampMs).toBe(series.domainStartMs)
    expect(series.data.at(-1)?.balanceSat).toBe(7500)
    expect(series.data.map((point) => point.timestampMs)).not.toContain(prior)
  })

  it('includes the full lifetime for the all timeframe', () => {
    const prior = new Date('2026-01-01T00:00:00Z').getTime()
    const within = new Date('2026-05-10T00:00:00Z').getTime()
    const history = {
      initialBalanceSat: 0,
      points: [
        { balanceSat: 5000, timestampMs: prior },
        { balanceSat: 7500, timestampMs: within }
      ]
    }
    const series = buildChartSeries(history, 7500, 'all')
    expect(series.domainStartMs).toBe(prior)
    expect(series.data.map((point) => point.timestampMs)).toContain(prior)
    expect(series.tickFormat).toBe('day')
  })

  it('returns flat series at endpoint when there are no points', () => {
    const series = buildChartSeries({ initialBalanceSat: 1234, points: [] }, 1234, 'all')
    expect(series.data).toStrictEqual([
      { balanceSat: 1234, timestampMs: series.domainStartMs },
      { balanceSat: 1234, timestampMs: series.domainEndMs }
    ])
  })
})
