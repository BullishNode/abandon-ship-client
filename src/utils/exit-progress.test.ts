import { describe, expect, it } from 'vitest'
import type { BlockRef } from '@/types/domain/chain'
import type { ExitTransactionStatus, ExitTx } from '@/types/domain/exit'
import {
  hasUnaddressedClaimable,
  resolveClaimGroups,
  resolvePrimaryClaimAddress,
  summarizeExits
} from './exit-progress'

const BLOCK: BlockRef = { hash: 'h', height: 100 }

function confirmedTx(txid: string): ExitTx {
  return {
    status: {
      block: BLOCK,
      childTxid: `${txid}-cpfp`,
      origin: { confirmedIn: BLOCK, type: 'wallet' },
      type: 'confirmed'
    },
    txid
  }
}

function pendingTx(txid: string): ExitTx {
  return { status: { type: 'verify-inputs' }, txid }
}

function startExit(vtxoId: string): ExitTransactionStatus {
  return { state: { tipHeight: 0, type: 'start' }, vtxoId }
}

function processingExit(vtxoId: string, transactions: ExitTx[]): ExitTransactionStatus {
  return { state: { tipHeight: 0, transactions, type: 'processing' }, vtxoId }
}

function claimedExit(vtxoId: string): ExitTransactionStatus {
  return { state: { block: BLOCK, tipHeight: 0, txid: vtxoId, type: 'claimed' }, vtxoId }
}

function claimableExit(vtxoId: string): ExitTransactionStatus {
  return { state: { claimableSince: BLOCK, tipHeight: 0, type: 'claimable' }, vtxoId }
}

function percentOf(summary: { confirmedLevels: number; totalLevels: number }): number {
  return summary.totalLevels === 0
    ? 0
    : Math.round((summary.confirmedLevels / summary.totalLevels) * 100)
}

describe(summarizeExits, () => {
  it('reports no progress for a freshly initiated exit', () => {
    const summary = summarizeExits([startExit('a')])
    expect(percentOf(summary)).toBe(0)
    expect(summary.totalLevels).toBe(1)
    expect(summary.confirmedLevels).toBe(0)
  })

  it('does not report 100% while one exit is still starting and another is claimed', () => {
    const summary = summarizeExits([claimedExit('a'), startExit('b')])
    expect(summary.claimed).toBe(1)
    expect(summary.total).toBe(2)
    expect(summary.totalLevels).toBe(2)
    expect(summary.confirmedLevels).toBe(1)
    expect(percentOf(summary)).toBe(50)
  })

  it('counts confirmed transactions of a processing exit toward progress', () => {
    const summary = summarizeExits([
      processingExit('a', [confirmedTx('t1'), pendingTx('t2'), pendingTx('t3')])
    ])
    expect(summary.totalLevels).toBe(3)
    expect(summary.confirmedLevels).toBe(1)
    expect(percentOf(summary)).toBe(33)
  })

  it('reports full progress only when every exit is claimed', () => {
    const summary = summarizeExits([claimedExit('a'), claimedExit('b')])
    expect(summary.isDone).toBeTruthy()
    expect(summary.inProgress).toBeFalsy()
    expect(percentOf(summary)).toBe(100)
  })

  it('handles an empty exit list without dividing by zero', () => {
    const summary = summarizeExits([])
    expect(summary.total).toBe(0)
    expect(summary.isDone).toBeFalsy()
    expect(summary.inProgress).toBeFalsy()
    expect(percentOf(summary)).toBe(0)
  })
})

const ADDR_1 = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const ADDR_2 = 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7'

describe(resolveClaimGroups, () => {
  it('groups claimable exits by their stored destination address', () => {
    const groups = resolveClaimGroups(
      [claimableExit('a'), claimableExit('b'), claimableExit('c')],
      { a: ADDR_1, b: ADDR_1, c: ADDR_2 },
      'signet'
    )
    expect(groups).toHaveLength(2)
    const byDestination = new Map(groups.map((group) => [group.destination, group.vtxos]))
    expect(byDestination.get(ADDR_1)).toStrictEqual(['a', 'b'])
    expect(byDestination.get(ADDR_2)).toStrictEqual(['c'])
  })

  it('skips exits that are not yet claimable', () => {
    const groups = resolveClaimGroups(
      [startExit('a'), claimableExit('b')],
      { a: ADDR_1, b: ADDR_2 },
      'signet'
    )
    expect(groups).toStrictEqual([{ destination: ADDR_2, vtxos: ['b'] }])
  })

  it('skips claimable exits with no stored address', () => {
    const groups = resolveClaimGroups(
      [claimableExit('a'), claimableExit('b')],
      { b: ADDR_2 },
      'signet'
    )
    expect(groups).toStrictEqual([{ destination: ADDR_2, vtxos: ['b'] }])
  })

  it('skips claimable exits whose stored address is not valid on the wallet network', () => {
    const mainnetAddress = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
    const groups = resolveClaimGroups(
      [claimableExit('a'), claimableExit('b'), claimableExit('c')],
      { a: 'not-an-address', b: mainnetAddress, c: ADDR_1 },
      'signet'
    )
    expect(groups).toStrictEqual([{ destination: ADDR_1, vtxos: ['c'] }])
  })

  it('skips non-string rehydrated address values without throwing', () => {
    const rehydrated: Record<string, string> = JSON.parse(
      `{"a":null,"b":42,"c":["${ADDR_1}"],"d":"${ADDR_1}"}`
    )
    const groups = resolveClaimGroups(
      [claimableExit('a'), claimableExit('b'), claimableExit('c'), claimableExit('d')],
      rehydrated,
      'signet'
    )
    expect(groups).toStrictEqual([{ destination: ADDR_1, vtxos: ['d'] }])
  })
})

describe(hasUnaddressedClaimable, () => {
  it('is true when a claimable exit has no stored address', () => {
    expect(hasUnaddressedClaimable([claimableExit('a')], {})).toBeTruthy()
  })

  it('is false when all claimable exits have a stored address', () => {
    expect(hasUnaddressedClaimable([claimableExit('a')], { a: 'addr-1' })).toBeFalsy()
  })

  it('ignores exits that are not yet claimable', () => {
    expect(hasUnaddressedClaimable([startExit('a')], {})).toBeFalsy()
  })
})

describe(resolvePrimaryClaimAddress, () => {
  it('returns the first exiting vtxo address present in the map', () => {
    expect(resolvePrimaryClaimAddress([startExit('a'), claimableExit('b')], { b: 'addr-2' })).toBe(
      'addr-2'
    )
  })

  it('returns null when no exiting vtxo has a stored address', () => {
    expect(resolvePrimaryClaimAddress([startExit('a')], {})).toBeNull()
  })
})
