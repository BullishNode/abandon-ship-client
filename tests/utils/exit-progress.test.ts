import { describe, expect, it } from 'vitest'
import { estimateEmergencyExitFeeSat, summarizeExits } from '../../src/utils/exit-progress'
import type {
  ExitState,
  ExitTransactionPackage,
  ExitTransactionStatus,
  ExitTx
} from '@/types/domain/exit'
import type { Vtxo } from '@/types/domain/vtxo'

const BLOCK = { hash: '00', height: 0 }

function makeExitTx(confirmed: boolean): ExitTx {
  if (confirmed) {
    return {
      status: {
        block: BLOCK,
        childTxid: 'child',
        origin: { confirmedIn: BLOCK, type: 'wallet' },
        type: 'confirmed'
      },
      txid: 'tx'
    }
  }
  return { status: { type: 'verify-inputs' }, txid: 'tx' }
}

function makeProcessingTxs(total: number, confirmed: number): ExitTx[] {
  return Array.from({ length: total }, (_, index) => makeExitTx(index < confirmed))
}

function makePackages(count: number): ExitTransactionPackage[] {
  return Array.from({ length: count }, () => ({ exit: { tx: '00', txid: 'tx' } }))
}

function makeVtxo(overrides: Partial<Vtxo> = {}): Vtxo {
  return {
    amountSats: 1000,
    chainAnchor: 'tx:0',
    exitDelta: 144,
    exitDepth: 1,
    expiryHeight: 1000,
    id: 'tx:0',
    policyType: 'default',
    serverPubkey: 'pubkey-server',
    state: { type: 'spendable' },
    userPubkey: 'pubkey-user',
    ...overrides
  }
}

interface MakeExitOptions {
  packageCount?: number
  processingTotal?: number
  processingConfirmed?: number
}

function makeExitState(type: ExitState['type'], options: MakeExitOptions = {}): ExitState {
  switch (type) {
    case 'start': {
      return { tipHeight: 0, type: 'start' }
    }
    case 'processing': {
      return {
        tipHeight: 0,
        transactions: makeProcessingTxs(
          options.processingTotal ?? 0,
          options.processingConfirmed ?? 0
        ),
        type: 'processing'
      }
    }
    case 'awaiting-delta': {
      return {
        claimableHeight: 0,
        confirmedBlock: BLOCK,
        tipHeight: 0,
        type: 'awaiting-delta'
      }
    }
    case 'claimable': {
      return { claimableSince: BLOCK, tipHeight: 0, type: 'claimable' }
    }
    case 'claim-in-progress': {
      return {
        claimTxid: 'tx',
        claimableSince: BLOCK,
        tipHeight: 0,
        type: 'claim-in-progress'
      }
    }
    case 'claimed': {
      return { block: BLOCK, tipHeight: 0, txid: 'tx', type: 'claimed' }
    }
    case 'vtxo-already-spent': {
      return { tipHeight: 0, type: 'vtxo-already-spent' }
    }
    case 'canceled': {
      return { tipHeight: 0, type: 'canceled' }
    }
    default: {
      throw new Error(`Unhandled exit state type: ${String(type)}`)
    }
  }
}

function makeExit(
  stateType: ExitState['type'],
  options: MakeExitOptions = {}
): ExitTransactionStatus {
  return {
    state: makeExitState(stateType, options),
    transactions: makePackages(options.packageCount ?? 0),
    vtxoId: `vtxo-${stateType}`
  }
}

const VBYTES_PER_EXIT_LEVEL = 200 + 175
const CLAIM_BASE_VBYTES = 50
const CLAIM_VBYTES_PER_VTXO = 70
const FEE_RATE_SAFETY_MULTIPLIER = 1.25

function expectedFee(depth: number, vtxoCount: number, feeRate: number): number {
  const exitVbytes = depth * VBYTES_PER_EXIT_LEVEL * vtxoCount
  const claimVbytes = CLAIM_BASE_VBYTES + CLAIM_VBYTES_PER_VTXO * vtxoCount
  return Math.ceil((exitVbytes + claimVbytes) * feeRate * FEE_RATE_SAFETY_MULTIPLIER)
}

describe(estimateEmergencyExitFeeSat, () => {
  it('returns 0 when no vtxos', () => {
    expect(estimateEmergencyExitFeeSat([], 5)).toBe(0)
  })

  it('returns 0 when feeRate is non-positive', () => {
    expect(estimateEmergencyExitFeeSat([makeVtxo()], 0)).toBe(0)
    expect(estimateEmergencyExitFeeSat([makeVtxo()], -1)).toBe(0)
  })

  it('charges both exit tx and CPFP child per level', () => {
    const result = estimateEmergencyExitFeeSat([makeVtxo({ exitDepth: 2 })], 1)
    expect(result).toBe(expectedFee(2, 1, 1))
  })

  it('defaults exitDepth to 1 when null', () => {
    const result = estimateEmergencyExitFeeSat([makeVtxo({ exitDepth: null })], 1)
    expect(result).toBe(expectedFee(1, 1, 1))
  })

  it('scales the per-level cost with exit depth', () => {
    const shallow = estimateEmergencyExitFeeSat([makeVtxo({ exitDepth: 1 })], 1)
    const deep = estimateEmergencyExitFeeSat([makeVtxo({ exitDepth: 8 })], 1)
    expect(deep).toBeGreaterThan(shallow * 6)
  })

  it('includes a safety buffer above the raw fee-rate cost', () => {
    const rawCost = (1 * VBYTES_PER_EXIT_LEVEL + CLAIM_BASE_VBYTES + CLAIM_VBYTES_PER_VTXO) * 5
    expect(estimateEmergencyExitFeeSat([makeVtxo({ exitDepth: 1 })], 5)).toBeGreaterThan(rawCost)
  })

  it('scales with fee rate', () => {
    expect(estimateEmergencyExitFeeSat([makeVtxo()], 3)).toBe(expectedFee(1, 1, 3))
  })
})

describe(summarizeExits, () => {
  it('reports zero totals for an empty list', () => {
    const result = summarizeExits([])
    expect(result.total).toBe(0)
    expect(result.inProgress).toBeFalsy()
    expect(result.isDone).toBeFalsy()
  })

  it('marks inProgress when at least one exit is not yet claimed', () => {
    const exits = [makeExit('processing'), makeExit('claimable')]
    const result = summarizeExits(exits)
    expect(result.inProgress).toBeTruthy()
    expect(result.isDone).toBeFalsy()
  })

  it('keeps inProgress while a claim is broadcast but not confirmed', () => {
    const exits = [makeExit('claim-in-progress'), makeExit('claimed')]
    const result = summarizeExits(exits)
    expect(result.inProgress).toBeTruthy()
    expect(result.isDone).toBeFalsy()
    expect(result.claimed).toBe(1)
  })

  it('marks isDone when every exit is claimed', () => {
    const exits = [makeExit('claimed'), makeExit('claimed')]
    const result = summarizeExits(exits)
    expect(result.inProgress).toBeFalsy()
    expect(result.isDone).toBeTruthy()
    expect(result.claimed).toBe(2)
  })

  it('treats a vtxo-already-spent exit as terminal', () => {
    const exits = [makeExit('claimed'), makeExit('vtxo-already-spent')]
    const result = summarizeExits(exits)
    expect(result.inProgress).toBeFalsy()
    expect(result.isDone).toBeTruthy()
  })

  it('counts confirmed exit-tree txs against total depth while processing', () => {
    const exits = [
      makeExit('processing', { packageCount: 8, processingConfirmed: 3, processingTotal: 8 })
    ]
    const result = summarizeExits(exits)
    expect(result.confirmedLevels).toBe(3)
    expect(result.totalLevels).toBe(8)
  })

  it('reports zero confirmed levels in the start state', () => {
    const result = summarizeExits([makeExit('start', { packageCount: 8 })])
    expect(result.confirmedLevels).toBe(0)
    expect(result.totalLevels).toBe(8)
  })

  it('counts a fully unrolled vtxo as all levels confirmed past processing', () => {
    for (const stateType of [
      'awaiting-delta',
      'claimable',
      'claim-in-progress',
      'claimed'
    ] as const) {
      const result = summarizeExits([makeExit(stateType, { packageCount: 5 })])
      expect(result.confirmedLevels).toBe(5)
      expect(result.totalLevels).toBe(5)
    }
  })

  it('counts an unrolled vtxo as complete when depth is unknown', () => {
    const result = summarizeExits([makeExit('claimable')])
    expect(result.confirmedLevels).toBe(1)
    expect(result.totalLevels).toBe(1)
  })

  it('aggregates levels across multiple exiting vtxos', () => {
    const exits = [
      makeExit('processing', { packageCount: 4, processingConfirmed: 1, processingTotal: 4 }),
      makeExit('claimed', { packageCount: 6 })
    ]
    const result = summarizeExits(exits)
    expect(result.confirmedLevels).toBe(7)
    expect(result.totalLevels).toBe(10)
  })

  it('falls back to processing tx count for total depth when packages are absent', () => {
    const result = summarizeExits([
      makeExit('processing', { processingConfirmed: 3, processingTotal: 8 })
    ])
    expect(result.confirmedLevels).toBe(3)
    expect(result.totalLevels).toBe(8)
  })

  it('tallies counts per known state type', () => {
    const exits = [
      makeExit('start'),
      makeExit('processing'),
      makeExit('processing'),
      makeExit('claimable'),
      makeExit('claim-in-progress'),
      makeExit('claimed')
    ]
    const result = summarizeExits(exits)
    expect(result.counts.processing).toBe(2)
    expect(result.counts.start).toBe(1)
    expect(result.counts.claimable).toBe(1)
    expect(result.counts['claim-in-progress']).toBe(1)
    expect(result.counts.claimed).toBe(1)
  })
})
