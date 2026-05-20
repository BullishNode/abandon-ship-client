import type { ExitState, ExitTransactionStatus, WalletVtxoInfo } from '@secondts/barkd'
import { describe, expect, it } from 'vitest'
import { estimateEmergencyExitFeeSat, summarizeExits } from '../../src/utils/exit-progress'

const BLOCK = { hash: '00', height: 0 }

function makeVtxo(overrides: Partial<WalletVtxoInfo> = {}): WalletVtxoInfo {
  return {
    amountSat: 1000,
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

function makeExitState(type: ExitState['type']): ExitState {
  switch (type) {
    case 'start': {
      return { tipHeight: 0, type: 'start' }
    }
    case 'processing': {
      return { tipHeight: 0, transactions: [], type: 'processing' }
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
    default: {
      throw new Error(`Unhandled exit state type: ${String(type)}`)
    }
  }
}

function makeExit(stateType: ExitState['type']): ExitTransactionStatus {
  return {
    state: makeExitState(stateType),
    transactions: [],
    vtxoId: `vtxo-${stateType}`
  }
}

describe(estimateEmergencyExitFeeSat, () => {
  it('returns 0 when no vtxos', () => {
    expect(estimateEmergencyExitFeeSat([], 5)).toBe(0)
  })

  it('returns 0 when feeRate is non-positive', () => {
    expect(estimateEmergencyExitFeeSat([makeVtxo()], 0)).toBe(0)
    expect(estimateEmergencyExitFeeSat([makeVtxo()], -1)).toBe(0)
  })

  it('uses exit depth multiplier for the exit cost', () => {
    const result = estimateEmergencyExitFeeSat([makeVtxo({ exitDepth: 2 })], 1)
    expect(result).toBe(Math.ceil(2 * 300 + (50 + 70 * 1)))
  })

  it('defaults exitDepth to 1 when null', () => {
    const result = estimateEmergencyExitFeeSat([makeVtxo({ exitDepth: null })], 1)
    expect(result).toBe(Math.ceil(1 * 300 + (50 + 70 * 1)))
  })

  it('scales linearly with fee rate', () => {
    const single = estimateEmergencyExitFeeSat([makeVtxo()], 1)
    const triple = estimateEmergencyExitFeeSat([makeVtxo()], 3)
    expect(triple).toBe(Math.ceil(single * 3))
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
