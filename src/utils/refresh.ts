import { PPM_DENOMINATOR } from '@/constants/btc'
import type { PpmExpiryFeeEntry, RefreshFees } from '@/types/domain/fees'
import type { PendingRound, RefreshingVtxo, RefreshPhase } from '@/types/domain/round'
import type { Vtxo } from '@/types/domain/vtxo'

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

const NO_IDS: ReadonlySet<string> = new Set()

// The state check covers barkd, which locks round inputs at registration. The
// wasm backend leaves a delegated participation's inputs spendable until the
// server issues the round, so those have to be excluded by id as well.
export function isRefreshable(vtxo: Vtxo, inRoundIds: ReadonlySet<string>): boolean {
  return vtxo.state.type === 'spendable' && !inRoundIds.has(vtxo.id)
}

export function getRefreshableVtxos(vtxos: Vtxo[], inRoundIds: ReadonlySet<string>): Vtxo[] {
  return vtxos.filter((vtxo) => isRefreshable(vtxo, inRoundIds))
}

export function getExpiringVtxoIds(
  vtxos: Vtxo[],
  tipHeight: number | undefined,
  thresholdBlocks: number,
  vtxoExpiryDelta?: number,
  inRoundIds: ReadonlySet<string> = NO_IDS
): string[] {
  if (tipHeight === undefined || vtxoExpiryDelta === undefined) {
    return []
  }
  const clampedThreshold = Math.min(thresholdBlocks, getLoopSafeMaxBlocks(vtxoExpiryDelta))
  const expiring: string[] = []
  for (const vtxo of getRefreshableVtxos(vtxos, inRoundIds)) {
    if (vtxo.expiryHeight - tipHeight <= clampedThreshold) {
      expiring.push(vtxo.id)
    }
  }
  return expiring
}

// A round that failed, was canceled or errored while syncing is still returned
// by barkd's `rounds` endpoint but is over: it must not count as in progress.
export function isRoundActive(round: PendingRound): boolean {
  const { type } = round.status
  return type === 'pending' || type === 'ongoing' || type === 'unconfirmed' || type === 'confirmed'
}

export function isRoundInProgress(pendingRounds?: PendingRound[]): boolean {
  return (pendingRounds ?? []).some(isRoundActive)
}

// `queued` until the round starts, then `refreshing`.
export function roundRefreshPhase(round: PendingRound): RefreshPhase {
  return round.status.type === 'pending' ? 'queued' : 'refreshing'
}

export function mapRefreshPhases(refreshing: RefreshingVtxo[]): Map<string, RefreshPhase> {
  return new Map(refreshing.map((vtxo) => [vtxo.id, vtxo.phase]))
}

export function refreshingVtxosFromRounds(pendingRounds: PendingRound[]): RefreshingVtxo[] {
  const refreshing: RefreshingVtxo[] = []
  for (const round of pendingRounds) {
    if (!isRoundActive(round)) {
      continue
    }
    const phase = roundRefreshPhase(round)
    for (const id of round.participation?.inputs ?? []) {
      refreshing.push({ id, phase })
    }
  }
  return refreshing
}

function refreshPpmForBlocksToExpiry(blocksToExpiry: number, table: PpmExpiryFeeEntry[]): number {
  const applicableTier = table.findLast((entry) => blocksToExpiry >= entry.expiryBlocksThreshold)
  return applicableTier?.ppm ?? 0
}

export function estimateRefreshAllFeeSat(
  vtxos?: Vtxo[],
  tipHeight?: number,
  refreshFees?: RefreshFees,
  inRoundIds: ReadonlySet<string> = NO_IDS
): number | undefined {
  if (vtxos === undefined || tipHeight === undefined || refreshFees === undefined) {
    return undefined
  }
  const spendable = getRefreshableVtxos(vtxos, inRoundIds)
  if (spendable.length === 0) {
    return undefined
  }
  const table = refreshFees.ppmExpiryTable.toSorted(
    (a, b) => a.expiryBlocksThreshold - b.expiryBlocksThreshold
  )
  let feeSat = refreshFees.baseFeeSats
  for (const vtxo of spendable) {
    const ppm = refreshPpmForBlocksToExpiry(vtxo.expiryHeight - tipHeight, table)
    feeSat += Math.floor((vtxo.amountSats * ppm) / PPM_DENOMINATOR)
  }
  return feeSat
}

const UNUSABLE_INPUTS_PATTERN = /unusable inputs: \[([^\]]*)\]/u

// The Ark server refuses a spent (paid-out) or banned coin with
// "unusable inputs: [id,id]". One such coin fails the whole batch, so callers
// leave these ids out of the next one.
export function parseUnusableInputIds(message?: string): string[] {
  const match = message === undefined ? null : UNUSABLE_INPUTS_PATTERN.exec(message)
  if (match === null) {
    return []
  }
  return match[1]
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
}
