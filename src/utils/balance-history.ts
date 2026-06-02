import type { Movement } from '@secondts/barkd'
import type { OnchainTxEntry } from '@/utils/movements-feed'

export interface BalanceDataPoint {
  timestampMs: number
  balanceSat: number
}

export interface BalanceHistory {
  initialBalanceSat: number
  points: BalanceDataPoint[]
}

export interface ChartSeries {
  data: BalanceDataPoint[]
  domainStartMs: number
  domainEndMs: number
  ticks: number[]
}

interface BalanceEvent {
  timestampMs: number
  deltaSat: number
}

function movementEvents(movements: Movement[]): BalanceEvent[] {
  const out: BalanceEvent[] = []
  for (const movement of movements) {
    if (movement.status !== 'successful') {
      continue
    }
    out.push({
      deltaSat: movement.effectiveBalanceSat,
      timestampMs: movement.time.createdAt.getTime()
    })
  }
  return out
}

function onchainTxEvents(entries: OnchainTxEntry[]): BalanceEvent[] {
  const out: BalanceEvent[] = []
  for (const entry of entries) {
    out.push({
      deltaSat: entry.amountSat,
      timestampMs: entry.approximateTimestampMs
    })
  }
  return out
}

export function computeBalanceHistory(
  movements: Movement[],
  onchainEntries: OnchainTxEntry[],
  endpointTotalSat: number
): BalanceHistory {
  const events = [...movementEvents(movements), ...onchainTxEvents(onchainEntries)]
  if (events.length === 0) {
    return { initialBalanceSat: endpointTotalSat, points: [] }
  }
  events.sort((a, b) => a.timestampMs - b.timestampMs)

  const totalDelta = events.reduce((sum, event) => sum + event.deltaSat, 0)
  const initialBalanceSat = endpointTotalSat - totalDelta
  let runningBalance = initialBalanceSat

  const points: BalanceDataPoint[] = []
  for (const event of events) {
    runningBalance += event.deltaSat
    points.push({
      balanceSat: runningBalance,
      timestampMs: event.timestampMs
    })
  }
  return { initialBalanceSat, points }
}

const DAYS_BY_RANGE: Record<string, number> = {
  '30d': 30,
  '7d': 7,
  '90d': 90
}

export function rangeWindow(
  timeRange: string,
  nowMs: number = Date.now()
): {
  startMs: number
  endMs: number
} {
  const days = DAYS_BY_RANGE[timeRange] ?? 90
  const startMs = nowMs - days * 24 * 60 * 60 * 1000
  return { endMs: nowMs, startMs }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function extractTimestampMs(point: unknown): number | undefined {
  if (typeof point !== 'object' || point === null) {
    return undefined
  }
  if (!('timestampMs' in point)) {
    return undefined
  }
  const ts = point.timestampMs
  return typeof ts === 'number' ? ts : undefined
}

export function buildDayTicks(startMs: number, endMs: number): number[] {
  if (endMs <= startMs) {
    return []
  }
  const rangeDays = Math.ceil((endMs - startMs) / MS_PER_DAY)
  const stepDays = Math.max(1, Math.ceil(rangeDays / 8))
  const firstDay = new Date(startMs)
  firstDay.setHours(0, 0, 0, 0)
  let cursor = firstDay.getTime()
  if (cursor < startMs) {
    cursor += MS_PER_DAY
  }
  const ticks: number[] = []
  while (cursor <= endMs) {
    ticks.push(cursor)
    cursor += stepDays * MS_PER_DAY
  }
  return ticks
}

export function filterByTimeRange(data: BalanceDataPoint[], timeRange: string): BalanceDataPoint[] {
  if (data.length === 0) {
    return []
  }
  const { startMs } = rangeWindow(timeRange)
  return data.filter((point) => point.timestampMs >= startMs)
}

export function buildChartSeries(
  history: BalanceHistory,
  timeRange: string,
  endpointTotalSat: number
): ChartSeries {
  const { startMs, endMs } = rangeWindow(timeRange)
  let preWindowBalance = history.initialBalanceSat
  const inRange: BalanceDataPoint[] = []
  for (const point of history.points) {
    if (point.timestampMs < startMs) {
      preWindowBalance = point.balanceSat
    } else if (point.timestampMs <= endMs) {
      inRange.push(point)
    }
  }
  const data: BalanceDataPoint[] = [
    { balanceSat: preWindowBalance, timestampMs: startMs },
    ...inRange,
    { balanceSat: endpointTotalSat, timestampMs: endMs }
  ]
  return {
    data,
    domainEndMs: endMs,
    domainStartMs: startMs,
    ticks: buildDayTicks(startMs, endMs)
  }
}
