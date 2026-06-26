import type { ExitTransactionStatus, Movement, WalletVtxoInfo } from '@secondts/barkd'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getExpiryTimeLabel,
  mapExitedVtxoIds,
  mapVtxoExitClaimHeights,
  mapVtxoExitPhases,
  mapVtxoExitStates,
  sortVtxosForDisplay
} from '../../src/utils/vtxo'

const t = i18next.t.bind(i18next)

function makeVtxo(
  id: string,
  expiryHeight: number,
  state?: WalletVtxoInfo['state']
): WalletVtxoInfo {
  return {
    amountSat: 1000,
    chainAnchor: `${id}-anchor`,
    exitDelta: 144,
    expiryHeight,
    id,
    policyType: 'pubkey',
    serverPubkey: 'server',
    state: state ?? { type: 'spendable' },
    userPubkey: 'user'
  }
}

function makeExitMovement(inputVtxos: string[], name = 'bark.exit'): Movement {
  return {
    effectiveBalanceSat: 0,
    exitedVtxos: [],
    id: 1,
    inputVtxos,
    intendedBalanceSat: 0,
    offchainFeeSat: 0,
    outputVtxos: [],
    receivedOn: [],
    sentTo: [],
    status: 'successful',
    subsystem: { kind: 'start', name },
    time: {
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z')
    }
  }
}

function makeClaimedExit(vtxoId: string, blockHeight: number): ExitTransactionStatus {
  return {
    state: {
      block: { hash: `${vtxoId}-hash`, height: blockHeight },
      tipHeight: 0,
      txid: 'txid',
      type: 'claimed'
    },
    vtxoId
  }
}

function makeSpendableExit(vtxoId: string): ExitTransactionStatus {
  return { state: { tipHeight: 0, type: 'start' }, vtxoId }
}

describe(getExpiryTimeLabel, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty string when the tip height is unknown', () => {
    expect(getExpiryTimeLabel(1000, t)).toBe('')
  })

  it('returns the expired label when the expiry height is at or below the tip', () => {
    expect(getExpiryTimeLabel(1000, t, 1000)).toBe('Expired')
    expect(getExpiryTimeLabel(900, t, 1000)).toBe('Expired')
  })

  it('estimates hours from the remaining blocks at ten minutes per block', () => {
    const result = getExpiryTimeLabel(1006, t, 1000)
    expect(result).toContain('1')
    expect(result).toContain('hour')
  })

  it('estimates minutes when less than an hour remains', () => {
    const result = getExpiryTimeLabel(1003, t, 1000)
    expect(result).toContain('30')
    expect(result).toContain('minute')
  })

  it('marks the estimate with a tilde before the number', () => {
    const result = getExpiryTimeLabel(1006, t, 1000)
    expect(result).toContain('~1')
    expect(result.startsWith('~')).toBeFalsy()
  })
})

function statesFromExits(vtxos: WalletVtxoInfo[], exits: ExitTransactionStatus[]) {
  return mapVtxoExitStates(vtxos, mapVtxoExitPhases(exits), new Set())
}

describe(sortVtxosForDisplay, () => {
  it('pushes exited vtxos below non-exited ones', () => {
    const vtxos = [makeVtxo('exited', 500), makeVtxo('live', 900)]
    const exits = [makeClaimedExit('exited', 100)]
    const states = statesFromExits(vtxos, exits)
    const heights = mapVtxoExitClaimHeights(exits)
    const sorted = sortVtxosForDisplay(vtxos, states, heights)
    expect(sorted.map((v) => v.id)).toStrictEqual(['live', 'exited'])
  })

  it('orders exited vtxos by claim block height descending (latest exited on top)', () => {
    const vtxos = [makeVtxo('old', 200), makeVtxo('new', 800), makeVtxo('mid', 500)]
    const exits = [
      makeClaimedExit('old', 100),
      makeClaimedExit('new', 300),
      makeClaimedExit('mid', 200)
    ]
    const states = statesFromExits(vtxos, exits)
    const heights = mapVtxoExitClaimHeights(exits)
    const sorted = sortVtxosForDisplay(vtxos, states, heights)
    expect(sorted.map((v) => v.id)).toStrictEqual(['new', 'mid', 'old'])
  })

  it('orders non-exited vtxos by expiry height ascending', () => {
    const vtxos = [makeVtxo('later', 900), makeVtxo('sooner', 400)]
    const sorted = sortVtxosForDisplay(vtxos, new Map(), new Map())
    expect(sorted.map((v) => v.id)).toStrictEqual(['sooner', 'later'])
  })
})

describe(mapExitedVtxoIds, () => {
  it('collects input vtxos only from bark.exit movements', () => {
    const movements = [makeExitMovement(['a:0', 'b:0']), makeExitMovement(['c:0'], 'bark.round')]
    const ids = mapExitedVtxoIds(movements)
    expect([...ids].toSorted()).toStrictEqual(['a:0', 'b:0'])
  })

  it('returns an empty set when there are no exit movements', () => {
    expect(mapExitedVtxoIds([]).size).toBe(0)
  })
})

describe(mapVtxoExitStates, () => {
  it('derives state from the live exit phase when present', () => {
    const vtxos = [makeVtxo('done', 500), makeVtxo('going', 600)]
    const phases = mapVtxoExitPhases([makeClaimedExit('done', 100), makeSpendableExit('going')])
    const states = mapVtxoExitStates(vtxos, phases, new Set())
    expect(states.get('done')).toBe('exited')
    expect(states.get('going')).toBe('exiting')
  })

  it('marks a spent vtxo exited from durable movements when the live phase is gone', () => {
    const vtxos = [makeVtxo('pruned', 500, { type: 'spent' })]
    const states = mapVtxoExitStates(vtxos, new Map(), new Set(['pruned']))
    expect(states.get('pruned')).toBe('exited')
  })

  it('ignores the durable signal for a non-spent vtxo with no live phase', () => {
    const vtxos = [makeVtxo('spendable', 500)]
    const states = mapVtxoExitStates(vtxos, new Map(), new Set(['spendable']))
    expect(states.has('spendable')).toBeFalsy()
  })

  it('prefers the live phase over the durable signal', () => {
    const vtxos = [makeVtxo('both', 500, { type: 'spent' })]
    const phases = mapVtxoExitPhases([makeSpendableExit('both')])
    const states = mapVtxoExitStates(vtxos, phases, new Set(['both']))
    expect(states.get('both')).toBe('exiting')
  })
})

describe(mapVtxoExitClaimHeights, () => {
  it('captures the claim block height only for claimed exits', () => {
    const heights = mapVtxoExitClaimHeights([makeClaimedExit('a', 123), makeSpendableExit('b')])
    expect(heights.get('a')).toBe(123)
    expect(heights.has('b')).toBeFalsy()
  })
})
