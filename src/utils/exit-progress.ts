import type { ExitState, ExitTransactionStatus, WalletVtxoInfo } from '@secondts/barkd'

export type ExitStateType = ExitState['type']

const EXIT_TX_VBYTES_PER_LEVEL = 200
const CPFP_CHILD_VBYTES_PER_LEVEL = 175
const CLAIM_BASE_VBYTES = 50
const CLAIM_VBYTES_PER_VTXO = 70
const FEE_RATE_SAFETY_MULTIPLIER = 1.25

const VBYTES_PER_EXIT_LEVEL = EXIT_TX_VBYTES_PER_LEVEL + CPFP_CHILD_VBYTES_PER_LEVEL

/**
 * A unilateral exit unrolls the VTXO tree as a chain of `exitDepth` zero-fee
 * txs, each broadcast in sequence and bumped by its own CPFP child. The fee
 * must therefore cover both the exit tx and its CPFP child at every level, not
 * the whole tree as one blob. A safety multiplier absorbs fee-rate drift while
 * the exit ripens, since underfunding stalls the exit part-way through.
 */
export function estimateEmergencyExitFeeSat(
  vtxos: WalletVtxoInfo[],
  feeRateSatPerVb: number
): number {
  if (vtxos.length === 0 || feeRateSatPerVb <= 0) {
    return 0
  }
  const exitVbytes = vtxos.reduce(
    (total, vtxo) => total + (vtxo.exitDepth ?? 1) * VBYTES_PER_EXIT_LEVEL,
    0
  )
  const claimVbytes = CLAIM_BASE_VBYTES + CLAIM_VBYTES_PER_VTXO * vtxos.length
  const feeSat = (exitVbytes + claimVbytes) * feeRateSatPerVb * FEE_RATE_SAFETY_MULTIPLIER
  return Math.ceil(feeSat)
}

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
  if (state.type === 'start') {
    return 0
  }
  if (state.type === 'processing') {
    return state.transactions.length
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
    'claim-in-progress': 0,
    claimable: 0,
    claimed: 0,
    processing: 0,
    start: 0
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
  return {
    claimable: counts.claimable,
    claimed: counts.claimed,
    confirmedLevels,
    counts,
    inProgress: total > 0 && counts.claimed < total,
    isDone: total > 0 && counts.claimed === total,
    total,
    totalLevels
  }
}

export function areAllExitsRipe(summary: ExitProgressSummary): boolean {
  const stillRipeningCount =
    summary.counts.start + summary.counts.processing + summary.counts['awaiting-delta']
  return stillRipeningCount === 0
}

export function resolveAutoClaimDestination(
  summary: ExitProgressSummary,
  pendingExitClaimAddress: string | null
): string | null {
  const hasClaimAddress = pendingExitClaimAddress !== null && pendingExitClaimAddress.length > 0
  if (!(areAllExitsRipe(summary) && summary.claimable > 0 && hasClaimAddress)) {
    return null
  }
  return pendingExitClaimAddress
}
