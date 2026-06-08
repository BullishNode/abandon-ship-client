import type { PendingRoundInfo, RefreshFees, WalletVtxoInfo } from '@secondts/barkd'
import { describe, expect, it } from 'vitest'
import {
  getExpiringVtxoIds,
  getLoopSafeMaxBlocks,
  getRefreshThresholdOptions,
  getThresholdLabelParts,
  hoursToBlocks,
  isRoundInProgress,
  resolveThresholdBlocks
} from '../../src/utils/refresh'

const MAINNET_EXPIRY_DELTA = 4032
const SIGNET_EXPIRY_DELTA = 144

const REFRESH_FEES: RefreshFees = {
  baseFeeSat: 0,
  ppmExpiryTable: [
    { expiryBlocksThreshold: 0, ppm: 0 },
    { expiryBlocksThreshold: 288, ppm: 2000 },
    { expiryBlocksThreshold: 1008, ppm: 4000 },
    { expiryBlocksThreshold: 2016, ppm: 5000 }
  ]
}

function makeVtxo(overrides: Partial<WalletVtxoInfo> = {}): WalletVtxoInfo {
  return {
    amountSat: 1000,
    chainAnchor: 'txid:0',
    exitDelta: 0,
    exitDepth: 0,
    expiryHeight: 100_000,
    id: 'txid:0',
    policyType: 'pubkey',
    serverPubkey: 'server',
    state: { type: 'spendable' },
    userPubkey: 'user',
    ...overrides
  }
}

function makeRound(overrides: Partial<PendingRoundInfo> = {}): PendingRoundInfo {
  return {
    fundingTxHex: null,
    fundingTxid: null,
    id: 1,
    participation: { inputs: [], outputs: [] },
    status: { error: '', status: 'sync-error' },
    unlockHash: null,
    ...overrides
  }
}

describe(hoursToBlocks, () => {
  it('converts hours to blocks at ~6 blocks per hour', () => {
    expect(hoursToBlocks(1)).toBe(6)
    expect(hoursToBlocks(24)).toBe(144)
    expect(hoursToBlocks(0)).toBe(0)
  })
})

describe(getLoopSafeMaxBlocks, () => {
  it('is half the vtxo expiry delta', () => {
    expect(getLoopSafeMaxBlocks(144)).toBe(72)
    expect(getLoopSafeMaxBlocks(4032)).toBe(2016)
  })
})

describe(getRefreshThresholdOptions, () => {
  it('is empty when the vtxo expiry delta is unknown', () => {
    expect(getRefreshThresholdOptions(undefined, REFRESH_FEES)).toStrictEqual([])
  })

  it('derives a free 1-day default plus one option per fee tier below the loop cap (mainnet)', () => {
    expect(getRefreshThresholdOptions(MAINNET_EXPIRY_DELTA, REFRESH_FEES)).toStrictEqual([
      { blocks: 144, ppm: 0 },
      { blocks: 287, ppm: 0 },
      { blocks: 1007, ppm: 2000 },
      { blocks: 2015, ppm: 4000 }
    ])
  })

  it('defaults to the free 1-day baseline when nothing is stored (mainnet)', () => {
    const options = getRefreshThresholdOptions(MAINNET_EXPIRY_DELTA, REFRESH_FEES)
    expect(resolveThresholdBlocks(0, options)).toBe(144)
  })

  it('falls back to the loop-safe fixed-hour menu when no fee tier fits (signet)', () => {
    expect(getRefreshThresholdOptions(SIGNET_EXPIRY_DELTA, REFRESH_FEES)).toStrictEqual([
      { blocks: 36, ppm: 0 },
      { blocks: 72, ppm: 0 }
    ])
  })

  it('falls back to the fixed-hour menu when the fee schedule is unknown', () => {
    expect(getRefreshThresholdOptions(MAINNET_EXPIRY_DELTA)).toStrictEqual([
      { blocks: 36, ppm: 0 },
      { blocks: 72, ppm: 0 },
      { blocks: 144, ppm: 0 },
      { blocks: 288, ppm: 0 },
      { blocks: 432, ppm: 0 }
    ])
  })
})

describe(resolveThresholdBlocks, () => {
  const options = [
    { blocks: 287, ppm: 0 },
    { blocks: 1007, ppm: 2000 }
  ]
  it('keeps a stored value that matches an option', () => {
    expect(resolveThresholdBlocks(1007, options)).toBe(1007)
  })
  it('falls back to the first (free) option when the stored value is invalid', () => {
    expect(resolveThresholdBlocks(99, options)).toBe(287)
  })
  it('is zero when there are no options', () => {
    expect(resolveThresholdBlocks(287, [])).toBe(0)
  })
})

describe(getThresholdLabelParts, () => {
  it('renders sub-day thresholds in hours', () => {
    expect(getThresholdLabelParts({ blocks: 72, ppm: 0 })).toStrictEqual({
      count: 12,
      feePercent: 0,
      unit: 'hours'
    })
  })
  it('renders day-scale thresholds in rounded days with a fee percent', () => {
    expect(getThresholdLabelParts({ blocks: 1007, ppm: 2000 })).toStrictEqual({
      count: 7,
      feePercent: 0.2,
      unit: 'days'
    })
  })
})

describe(getExpiringVtxoIds, () => {
  it('is empty when no vtxos', () => {
    expect(getExpiringVtxoIds([], 100, 144, MAINNET_EXPIRY_DELTA)).toStrictEqual([])
  })

  it('is empty when tip is unknown', () => {
    expect(getExpiringVtxoIds([makeVtxo()], undefined, 144, MAINNET_EXPIRY_DELTA)).toStrictEqual([])
  })

  it('is empty when vtxo expiry delta is unknown', () => {
    expect(getExpiringVtxoIds([makeVtxo({ expiryHeight: 1100 })], 1000, 144)).toStrictEqual([])
  })

  it('returns only the ids within the threshold window', () => {
    const vtxos = [
      makeVtxo({ expiryHeight: 1100, id: 'expiring:0' }),
      makeVtxo({ expiryHeight: 5000, id: 'safe:0' })
    ]
    expect(getExpiringVtxoIds(vtxos, 1000, 287, MAINNET_EXPIRY_DELTA)).toStrictEqual(['expiring:0'])
  })

  it('includes a vtxo exactly at the threshold boundary', () => {
    const vtxos = [makeVtxo({ expiryHeight: 1000 + 287, id: 'boundary:0' })]
    expect(getExpiringVtxoIds(vtxos, 1000, 287, MAINNET_EXPIRY_DELTA)).toStrictEqual(['boundary:0'])
  })

  it('skips non-spendable vtxos even when expiring', () => {
    const vtxos = [
      makeVtxo({ expiryHeight: 1100, id: 'locked:0', state: { type: 'locked' } }),
      makeVtxo({ expiryHeight: 1100, id: 'spendable:0' })
    ]
    expect(getExpiringVtxoIds(vtxos, 1000, 287, MAINNET_EXPIRY_DELTA)).toStrictEqual([
      'spendable:0'
    ])
  })

  it('clamps the threshold to half the lifetime so a fresh vtxo cannot re-trigger', () => {
    const fresh = [makeVtxo({ expiryHeight: 1000 + SIGNET_EXPIRY_DELTA, id: 'fresh:0' })]
    expect(getExpiringVtxoIds(fresh, 1000, 999, SIGNET_EXPIRY_DELTA)).toStrictEqual([])
  })

  it('flags a vtxo once its remaining lifetime drops below the clamped threshold', () => {
    const aged = [makeVtxo({ expiryHeight: 1000 + 72, id: 'aged:0' })]
    expect(getExpiringVtxoIds(aged, 1000, 999, SIGNET_EXPIRY_DELTA)).toStrictEqual(['aged:0'])
  })
})

describe(isRoundInProgress, () => {
  it('is false when undefined or empty', () => {
    expect(isRoundInProgress()).toBeFalsy()
    expect(isRoundInProgress([])).toBeFalsy()
  })

  it('is true when at least one round is pending', () => {
    expect(isRoundInProgress([makeRound()])).toBeTruthy()
  })
})
