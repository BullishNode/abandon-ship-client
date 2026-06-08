import type { PendingRoundInfo, RefreshFees, WalletVtxoInfo } from '@secondts/barkd'

const BLOCKS_PER_HOUR = 6
const BLOCKS_PER_DAY = 144
const PPM_PER_PERCENT = 10_000
const REFRESH_THRESHOLD_MAX_LIFETIME_RATIO = 0.5
const FALLBACK_THRESHOLD_HOURS = [6, 12, 24, 48, 72]
const DEFAULT_FREE_BUFFER_HOURS = 24

export interface RefreshThresholdOption {
  blocks: number
  ppm: number
}

export interface RefreshThresholdLabelParts {
  unit: 'days' | 'hours'
  count: number
  feePercent: number
}

export function hoursToBlocks(hours: number): number {
  return Math.round(hours * BLOCKS_PER_HOUR)
}

export function getThresholdLabelParts(option: RefreshThresholdOption): RefreshThresholdLabelParts {
  const feePercent = option.ppm / PPM_PER_PERCENT
  if (option.blocks >= BLOCKS_PER_DAY) {
    return { count: Math.round(option.blocks / BLOCKS_PER_DAY), feePercent, unit: 'days' }
  }
  return { count: Math.round(option.blocks / BLOCKS_PER_HOUR), feePercent, unit: 'hours' }
}

export function getLoopSafeMaxBlocks(vtxoExpiryDelta: number): number {
  return Math.floor(vtxoExpiryDelta * REFRESH_THRESHOLD_MAX_LIFETIME_RATIO)
}

function buildTierOptions(refreshFees: RefreshFees, maxBlocks: number): RefreshThresholdOption[] {
  const table = refreshFees.ppmExpiryTable.toSorted(
    (a, b) => a.expiryBlocksThreshold - b.expiryBlocksThreshold
  )
  const options: RefreshThresholdOption[] = []
  for (let i = 1; i < table.length; i += 1) {
    const blocks = table[i].expiryBlocksThreshold - 1
    if (blocks > 0 && blocks <= maxBlocks) {
      options.push({ blocks, ppm: table[i - 1].ppm })
    }
  }
  if (options.length === 0) {
    return options
  }
  const firstPaidThreshold = table.find((entry) => entry.ppm > 0)?.expiryBlocksThreshold
  const baselineBlocks = hoursToBlocks(DEFAULT_FREE_BUFFER_HOURS)
  const isFreeBaseline = firstPaidThreshold !== undefined && baselineBlocks < firstPaidThreshold
  const fitsBaseline = baselineBlocks <= maxBlocks
  const isNewBaseline = !options.some((option) => option.blocks === baselineBlocks)
  if (isFreeBaseline && fitsBaseline && isNewBaseline) {
    options.unshift({ blocks: baselineBlocks, ppm: 0 })
  }
  return options
}

function buildFallbackOptions(maxBlocks: number): RefreshThresholdOption[] {
  return FALLBACK_THRESHOLD_HOURS.map((hours) => ({ blocks: hoursToBlocks(hours), ppm: 0 })).filter(
    (option) => option.blocks <= maxBlocks
  )
}

export function getRefreshThresholdOptions(
  vtxoExpiryDelta?: number,
  refreshFees?: RefreshFees
): RefreshThresholdOption[] {
  if (vtxoExpiryDelta === undefined) {
    return []
  }
  const maxBlocks = getLoopSafeMaxBlocks(vtxoExpiryDelta)
  const tierOptions = refreshFees ? buildTierOptions(refreshFees, maxBlocks) : []
  return tierOptions.length > 0 ? tierOptions : buildFallbackOptions(maxBlocks)
}

export function resolveThresholdBlocks(
  storedBlocks: number,
  options: RefreshThresholdOption[]
): number {
  const match = options.find((option) => option.blocks === storedBlocks)
  return match?.blocks ?? options[0]?.blocks ?? 0
}

export function getExpiringVtxoIds(
  vtxos: WalletVtxoInfo[],
  tipHeight: number | undefined,
  thresholdBlocks: number,
  vtxoExpiryDelta?: number
): string[] {
  if (tipHeight === undefined || vtxoExpiryDelta === undefined) {
    return []
  }
  const clampedThreshold = Math.min(thresholdBlocks, getLoopSafeMaxBlocks(vtxoExpiryDelta))
  const expiring: string[] = []
  for (const vtxo of vtxos) {
    const isSpendable = vtxo.state.type === 'spendable'
    if (isSpendable && vtxo.expiryHeight - tipHeight <= clampedThreshold) {
      expiring.push(vtxo.id)
    }
  }
  return expiring
}

export function isRoundInProgress(pendingRounds?: PendingRoundInfo[]): boolean {
  return (pendingRounds?.length ?? 0) > 0
}
