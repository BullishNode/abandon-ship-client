import { describe, expect, it } from 'vitest'
import {
  getExpiringVtxoIds,
  getLoopSafeMaxBlocks,
  getRefreshThresholdOptions,
  getThresholdLabelParts,
  hoursToBlocks,
  isRoundInProgress,
  mapRefreshPhases,
  parseUnusableInputIds,
  refreshingVtxosFromRounds,
  resolveThresholdBlocks,
  roundRefreshPhase
} from '../../src/utils/refresh'
import type { RefreshFees } from '@/types/domain/fees'
import type { PendingRound, RoundStatus } from '@/types/domain/round'
import type { Vtxo } from '@/types/domain/vtxo'

const MAINNET_EXPIRY_DELTA = 4032
const SIGNET_EXPIRY_DELTA = 144

const REFRESH_FEES: RefreshFees = {
  baseFeeSats: 0,
  ppmExpiryTable: [
    { expiryBlocksThreshold: 0, ppm: 0 },
    { expiryBlocksThreshold: 288, ppm: 2000 },
    { expiryBlocksThreshold: 1008, ppm: 4000 },
    { expiryBlocksThreshold: 2016, ppm: 5000 }
  ]
}

function makeVtxo(overrides: Partial<Vtxo> = {}): Vtxo {
  return {
    amountSats: 1000,
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

function makeRound(overrides: Partial<PendingRound> = {}): PendingRound {
  return {
    fundingTxHex: null,
    fundingTxid: null,
    id: 1,
    participation: { inputs: [], outputs: [] },
    status: { error: '', type: 'sync-error' },
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

  it('skips spendable vtxos that already sit in a round', () => {
    const vtxos = [
      makeVtxo({ expiryHeight: 1100, id: 'queued:0' }),
      makeVtxo({ expiryHeight: 1100, id: 'free:0' })
    ]
    expect(
      getExpiringVtxoIds(vtxos, 1000, 287, MAINNET_EXPIRY_DELTA, new Set(['queued:0']))
    ).toStrictEqual(['free:0'])
  })
})

function makeWasmRound(status: RoundStatus): PendingRound {
  return { id: 1, status }
}

function makeBarkdRound(status: RoundStatus, inputs: string[] = []): PendingRound {
  return makeRound({ participation: { inputs, outputs: [] }, status })
}

describe(isRoundInProgress, () => {
  it('is false when undefined or empty', () => {
    expect(isRoundInProgress()).toBeFalsy()
    expect(isRoundInProgress([])).toBeFalsy()
  })

  it('is true while a barkd round is still running', () => {
    expect(isRoundInProgress([makeBarkdRound({ type: 'pending' })])).toBeTruthy()
    expect(
      isRoundInProgress([makeBarkdRound({ fundingTxid: 'tx', type: 'unconfirmed' })])
    ).toBeTruthy()
    expect(
      isRoundInProgress([makeBarkdRound({ fundingTxid: 'tx', type: 'confirmed' })])
    ).toBeTruthy()
  })

  it('is false for barkd rounds that already ended', () => {
    expect(isRoundInProgress([makeBarkdRound({ error: 'boom', type: 'failed' })])).toBeFalsy()
    expect(isRoundInProgress([makeBarkdRound({ type: 'canceled' })])).toBeFalsy()
    expect(isRoundInProgress([makeRound()])).toBeFalsy()
  })

  it('follows the mapped state of a wasm round', () => {
    expect(isRoundInProgress([makeWasmRound({ type: 'pending' })])).toBeTruthy()
    expect(isRoundInProgress([makeWasmRound({ type: 'ongoing' })])).toBeTruthy()
    expect(isRoundInProgress([makeWasmRound({ type: 'unconfirmed' })])).toBeTruthy()
    expect(isRoundInProgress([makeWasmRound({ error: 'boom', type: 'failed' })])).toBeFalsy()
    expect(isRoundInProgress([makeWasmRound({ type: 'canceled' })])).toBeFalsy()
  })
})

describe(roundRefreshPhase, () => {
  it('is queued only while the round is pending', () => {
    expect(roundRefreshPhase(makeBarkdRound({ type: 'pending' }))).toBe('queued')
    expect(roundRefreshPhase(makeWasmRound({ type: 'ongoing' }))).toBe('refreshing')
    expect(roundRefreshPhase(makeBarkdRound({ fundingTxid: 'tx', type: 'unconfirmed' }))).toBe(
      'refreshing'
    )
    expect(roundRefreshPhase(makeBarkdRound({ fundingTxid: 'tx', type: 'confirmed' }))).toBe(
      'refreshing'
    )
  })
})

describe(refreshingVtxosFromRounds, () => {
  it('labels every input of an active round', () => {
    expect(
      refreshingVtxosFromRounds([makeBarkdRound({ type: 'pending' }, ['a:0', 'b:1'])])
    ).toStrictEqual([
      { id: 'a:0', phase: 'queued' },
      { id: 'b:1', phase: 'queued' }
    ])
  })

  it('drops inputs of rounds that already ended', () => {
    expect(
      refreshingVtxosFromRounds([makeBarkdRound({ error: 'boom', type: 'failed' }, ['a:0'])])
    ).toStrictEqual([])
  })

  it('yields nothing for wasm rounds, which carry no participation', () => {
    expect(refreshingVtxosFromRounds([makeWasmRound({ type: 'ongoing' })])).toStrictEqual([])
  })
})

describe(mapRefreshPhases, () => {
  it('indexes phases by vtxo id', () => {
    const phases = mapRefreshPhases([
      { id: 'a:0', phase: 'queued' },
      { id: 'b:1', phase: 'refreshing' }
    ])
    expect(phases.get('a:0')).toBe('queued')
    expect(phases.get('b:1')).toBe('refreshing')
    expect(phases.get('c:2')).toBeUndefined()
  })
})

describe(parseUnusableInputIds, () => {
  it('reads the ids from the server refusal', () => {
    const message = 'round failed: input vtxo(s) not spendable: unusable inputs: [aa:0,bb:1]'
    expect(parseUnusableInputIds(message)).toStrictEqual(['aa:0', 'bb:1'])
  })

  it('returns nothing for any other error', () => {
    expect(parseUnusableInputIds('connection refused')).toStrictEqual([])
    expect(parseUnusableInputIds()).toStrictEqual([])
  })
})
