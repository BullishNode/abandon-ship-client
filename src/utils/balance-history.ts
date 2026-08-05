import type { Movement, MovementStatus } from '@/types/domain/movement'
import { getBoardFundingTxids, isArkToOnchainTransfer, isBoardSubsystem } from '@/utils/movement'
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

const NON_BALANCE_MOVEMENT_STATUSES = new Set<MovementStatus>(['failed', 'canceled'])

function movementEvents(movements: Movement[]): BalanceEvent[] {
  const out: BalanceEvent[] = []
  for (const movement of movements) {
    if (NON_BALANCE_MOVEMENT_STATUSES.has(movement.status)) {
      continue
    }
    out.push({
      deltaSat: movement.effectiveBalanceSats,
      timestampMs: new Date(movement.createdAt).getTime()
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

interface CollapsedTransfers {
  collapsedEvents: BalanceEvent[]
  consumedMovementIds: Set<number>
  consumedTxids: Set<string>
}

/**
 * An ark→onchain transfer is an internal transfer between the two ledgers
 * the chart sums (`offchain + onchain`): the movement leg debits the ark
 * balance and the on-chain landing credits the wallet by the same
 * principal. Counted as two legs they teleport the balance, because the
 * legs carry different timestamps. Collapse each matched pair into a
 * single net (fee-only) step at the movement time so the principal never
 * appears to leave and return.
 */
function collapseArkToOnchainTransfers(
  movements: Movement[],
  onchainEntries: OnchainTxEntry[]
): CollapsedTransfers {
  const collapsedEvents: BalanceEvent[] = []
  const consumedMovementIds = new Set<number>()
  const consumedTxids = new Set<string>()
  for (const movement of movements) {
    if (!isArkToOnchainTransfer(movement.subsystem)) {
      continue
    }
    if (NON_BALANCE_MOVEMENT_STATUSES.has(movement.status)) {
      continue
    }
    const address = movement.sentTo[0]?.value
    if (address === undefined) {
      continue
    }
    const landing = onchainEntries.find(
      (entry) =>
        entry.direction === 'incoming' &&
        entry.bindingAddress === address &&
        !consumedTxids.has(entry.txid)
    )
    if (landing === undefined) {
      continue
    }
    consumedTxids.add(landing.txid)
    consumedMovementIds.add(movement.id)
    collapsedEvents.push({
      deltaSat: movement.effectiveBalanceSats + landing.amountSat,
      timestampMs: new Date(movement.createdAt).getTime()
    })
  }
  return { collapsedEvents, consumedMovementIds, consumedTxids }
}

/**
 * A board is the mirror internal transfer (onchain→ark): the movement leg
 * credits the ark balance at `createdAt` while the funding tx debits the
 * on-chain wallet at its own (later) timestamp. Counted separately, the
 * balance is double-counted between the two timestamps and the chart spikes
 * to a value the wallet never held. Collapse each board movement with its
 * funding tx into a single net (fee-only) step at the movement time.
 */
function collapseBoardTransfers(
  movements: Movement[],
  onchainEntries: OnchainTxEntry[],
  alreadyConsumedTxids: Set<string>
): CollapsedTransfers {
  const collapsedEvents: BalanceEvent[] = []
  const consumedMovementIds = new Set<number>()
  const consumedTxids = new Set<string>()
  for (const movement of movements) {
    if (!isBoardSubsystem(movement.subsystem)) {
      continue
    }
    if (NON_BALANCE_MOVEMENT_STATUSES.has(movement.status)) {
      continue
    }
    const fundingTxids = getBoardFundingTxids([movement])
    const funding = onchainEntries.find(
      (entry) =>
        entry.direction === 'outgoing' &&
        fundingTxids.has(entry.txid) &&
        !alreadyConsumedTxids.has(entry.txid) &&
        !consumedTxids.has(entry.txid)
    )
    if (funding === undefined) {
      continue
    }
    consumedTxids.add(funding.txid)
    consumedMovementIds.add(movement.id)
    collapsedEvents.push({
      deltaSat: movement.effectiveBalanceSats + funding.amountSat,
      timestampMs: new Date(movement.createdAt).getTime()
    })
  }
  return { collapsedEvents, consumedMovementIds, consumedTxids }
}

export function computeBalanceHistory(
  movements: Movement[],
  onchainEntries: OnchainTxEntry[],
  endpointTotalSat: number
): BalanceHistory {
  const arkToOnchain = collapseArkToOnchainTransfers(movements, onchainEntries)
  const boards = collapseBoardTransfers(movements, onchainEntries, arkToOnchain.consumedTxids)
  const consumedMovementIds = new Set([
    ...arkToOnchain.consumedMovementIds,
    ...boards.consumedMovementIds
  ])
  const consumedTxids = new Set([...arkToOnchain.consumedTxids, ...boards.consumedTxids])
  const events = [
    ...movementEvents(movements.filter((movement) => !consumedMovementIds.has(movement.id))),
    ...onchainTxEvents(onchainEntries.filter((entry) => !consumedTxids.has(entry.txid))),
    ...arkToOnchain.collapsedEvents,
    ...boards.collapsedEvents
  ]
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

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MIN_WINDOW_DAYS = 1
const MAX_WINDOW_DAYS = 90

export function computeWindow(
  history: BalanceHistory,
  nowMs: number = Date.now()
): {
  startMs: number
  endMs: number
} {
  const oldest = history.points[0]?.timestampMs ?? nowMs
  const spanDays = (nowMs - oldest) / MS_PER_DAY
  const windowDays = Math.min(MAX_WINDOW_DAYS, Math.max(MIN_WINDOW_DAYS, spanDays))
  return { endMs: nowMs, startMs: nowMs - windowDays * MS_PER_DAY }
}

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

export function buildChartSeries(history: BalanceHistory, endpointTotalSat: number): ChartSeries {
  const { startMs, endMs } = computeWindow(history)
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
