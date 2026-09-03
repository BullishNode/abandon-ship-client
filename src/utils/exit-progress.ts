import type { ExitState, ExitTransactionStatus } from '@/types/domain/exit'
import type { Network } from '@/types/domain/network'
import { isValidOnchainAddress } from '@/utils/bitcoin'

export type ExitStateType = ExitState['type']

export interface ExitProgressSummary {
  total: number
  claimed: number
  claimable: number
  confirmedLevels: number
  totalLevels: number
  inProgress: boolean
  isDone: boolean
  counts: Record<ExitStateType, number>
}

function exitTotalLevels(exit: ExitTransactionStatus): number {
  const packageCount = exit.transactions?.length ?? 0
  if (packageCount > 0) {
    return packageCount
  }
  const { state } = exit
  if (state.type === 'processing') {
    // A processing exit with no per-level data yet (the WASM backend supplies
    // none) must still weigh at least one unconfirmed level, or it would count
    // 0/0 and the bar could show 100% while exits are in flight.
    return Math.max(state.transactions.length, 1)
  }
  return 1
}

function exitConfirmedLevels(exit: ExitTransactionStatus): number {
  const { state } = exit
  if (state.type === 'start') {
    return 0
  }
  if (state.type === 'processing') {
    return state.transactions.filter((tx) => tx.status.type === 'confirmed').length
  }
  return exitTotalLevels(exit)
}

export function summarizeExits(exits: ExitTransactionStatus[]): ExitProgressSummary {
  const counts: Record<ExitStateType, number> = {
    'awaiting-delta': 0,
    canceled: 0,
    'claim-in-progress': 0,
    claimable: 0,
    claimed: 0,
    processing: 0,
    start: 0,
    'vtxo-already-spent': 0
  }
  let confirmedLevels = 0
  let totalLevels = 0
  for (const exit of exits) {
    const stateType = exit.state.type
    if (stateType in counts) {
      counts[stateType] += 1
    }
    confirmedLevels += exitConfirmedLevels(exit)
    totalLevels += exitTotalLevels(exit)
  }
  const total = exits.length
  const terminal = counts.claimed + counts['vtxo-already-spent'] + counts.canceled
  return {
    claimable: counts.claimable,
    claimed: counts.claimed,
    confirmedLevels,
    counts,
    inProgress: total > 0 && terminal < total,
    isDone: total > 0 && terminal === total,
    total,
    totalLevels
  }
}

export interface ExitClaimGroup {
  destination: string
  vtxos: string[]
}

function hasAddress(addresses: Record<string, string>, vtxoId: string): boolean {
  const address = addresses[vtxoId]
  return typeof address === 'string' && address.length > 0
}

export function resolveClaimGroups(
  exits: ExitTransactionStatus[],
  addresses: Record<string, string>,
  network: Network
): ExitClaimGroup[] {
  const byDestination = new Map<string, string[]>()
  for (const exit of exits) {
    if (exit.state.type !== 'claimable' || !hasAddress(addresses, exit.vtxoId)) {
      continue
    }
    const destination = addresses[exit.vtxoId]
    // The stored address may come from persisted state that no code path
    // validated (localStorage rehydration), so re-check before funds move.
    if (!isValidOnchainAddress(destination, network)) {
      continue
    }
    const group = byDestination.get(destination)
    if (group) {
      group.push(exit.vtxoId)
    } else {
      byDestination.set(destination, [exit.vtxoId])
    }
  }
  return Array.from(byDestination, ([destination, vtxos]) => ({ destination, vtxos }))
}

const MUTABLE_CLAIM_ADDRESS_STATES = new Set<ExitStateType>([
  'start',
  'processing',
  'awaiting-delta',
  'claimable'
])

export function vtxoIdsWithMutableClaimAddress(exits: ExitTransactionStatus[]): string[] {
  return exits
    .filter((exit) => MUTABLE_CLAIM_ADDRESS_STATES.has(exit.state.type))
    .map((exit) => exit.vtxoId)
}

export function hasUnaddressedClaimable(
  exits: ExitTransactionStatus[],
  addresses: Record<string, string>
): boolean {
  return exits.some(
    (exit) => exit.state.type === 'claimable' && !hasAddress(addresses, exit.vtxoId)
  )
}

export function resolvePrimaryClaimAddress(
  exits: ExitTransactionStatus[],
  addresses: Record<string, string>
): string | null {
  for (const exit of exits) {
    if (hasAddress(addresses, exit.vtxoId)) {
      return addresses[exit.vtxoId]
    }
  }
  return null
}
