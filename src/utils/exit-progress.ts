import type { ExitState, ExitTransactionStatus, WalletVtxoInfo } from '@secondts/barkd'

export type ExitStateType = ExitState['type']

const EXIT_VBYTES_PER_LEVEL = 300
const CLAIM_BASE_VBYTES = 50
const CLAIM_VBYTES_PER_VTXO = 70

export function estimateEmergencyExitFeeSat(
  vtxos: WalletVtxoInfo[],
  feeRateSatPerVb: number
): number {
  if (vtxos.length === 0 || feeRateSatPerVb <= 0) {
    return 0
  }
  let exitVbytes = 0
  for (const vtxo of vtxos) {
    exitVbytes += (vtxo.exitDepth ?? 1) * EXIT_VBYTES_PER_LEVEL
  }
  const claimVbytes = CLAIM_BASE_VBYTES + CLAIM_VBYTES_PER_VTXO * vtxos.length
  return Math.ceil((exitVbytes + claimVbytes) * feeRateSatPerVb)
}

export interface ExitProgressSummary {
  total: number
  claimed: number
  claimable: number
  inProgress: boolean
  isDone: boolean
  counts: Record<ExitStateType, number>
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
  for (const exit of exits) {
    const stateType = exit.state.type
    if (stateType in counts) {
      counts[stateType] += 1
    }
  }
  const total = exits.length
  return {
    claimable: counts.claimable,
    claimed: counts.claimed,
    counts,
    inProgress: total > 0 && counts.claimed < total,
    isDone: total > 0 && counts.claimed === total,
    total
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
