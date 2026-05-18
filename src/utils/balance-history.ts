import type { Movement } from '@secondts/barkd'
import type { OnchainTxEntry } from '@/utils/movements-feed'

export interface BalanceDataPoint {
  date: string
  balanceSat: number
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
    if (entry.status !== 'successful') {
      continue
    }
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
): BalanceDataPoint[] {
  const events = [...movementEvents(movements), ...onchainTxEvents(onchainEntries)]
  if (events.length === 0) {
    return []
  }
  events.sort((a, b) => a.timestampMs - b.timestampMs)

  const totalDelta = events.reduce((sum, event) => sum + event.deltaSat, 0)
  let runningBalance = endpointTotalSat - totalDelta

  const points: BalanceDataPoint[] = []
  for (const event of events) {
    runningBalance += event.deltaSat
    points.push({
      balanceSat: runningBalance,
      date: new Date(event.timestampMs).toISOString()
    })
  }
  return points
}

export function filterByTimeRange(data: BalanceDataPoint[], timeRange: string): BalanceDataPoint[] {
  if (data.length === 0) {
    return []
  }

  const now = new Date()
  let daysToSubtract = 90

  if (timeRange === '30d') {
    daysToSubtract = 30
  } else if (timeRange === '7d') {
    daysToSubtract = 7
  }

  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - daysToSubtract)

  return data.filter((point) => new Date(point.date) >= startDate)
}
