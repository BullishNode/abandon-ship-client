import type { Movement } from '@secondts/barkd'

export interface BalanceDataPoint {
  date: string
  balanceSat: number
}

export function computeBalanceHistory(
  movements: Movement[],
  currentBalanceSat: number
): BalanceDataPoint[] {
  const sorted = movements
    .filter((m) => m.status === 'successful')
    .toSorted((a, b) => a.time.createdAt.getTime() - b.time.createdAt.getTime())

  if (sorted.length === 0) {
    return []
  }

  const totalChange = sorted.reduce((sum: number, m) => sum + m.effectiveBalanceSat, 0)
  let runningBalance = currentBalanceSat - totalChange

  const points: BalanceDataPoint[] = []

  for (const movement of sorted) {
    runningBalance += movement.effectiveBalanceSat
    points.push({
      balanceSat: runningBalance,
      date: movement.time.createdAt.toISOString()
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
