import { describe, expect, it } from 'vitest'
import { summarizeExits } from '../../src/utils/exit-progress'
import type {
  ExitState,
  ExitTransactionPackage,
  ExitTransactionStatus,
  ExitTx
} from '@/types/domain/exit'

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
