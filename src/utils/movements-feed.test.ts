import { describe, expect, it } from 'vitest'
import type { Movement } from '@/types/domain/movement'
import { createMovement } from '../../tests/fixtures/movements'
import { filterFeedByTab, getFeedRowSource } from './movements-feed'
import type { MovementEntry, OnchainTxEntry } from './movements-feed'

function makeOnchainEntry(overrides: Partial<OnchainTxEntry> = {}): OnchainTxEntry {
  return {
    amountSat: -10_000,
    approximateTimestampMs: 0,
    bindingAddress: undefined,
    confirmationHeight: null,
    direction: 'outgoing',
    feeSat: null,
    firstSeenMs: null,
    isBoard: false,
    isCpfp: false,
    kind: 'onchain',
    status: 'pending',
    txid: 'a'.repeat(64),
    ...overrides
  }
}

function makeMovementEntry(subsystem: Movement['subsystem']): MovementEntry {
  return {
    kind: 'movement',
    movement: createMovement({ subsystem })
  }
}

describe(getFeedRowSource, () => {
  it('resolves board funding transactions to board', () => {
    expect(getFeedRowSource(makeOnchainEntry({ isBoard: true }))).toBe('board')
  })

  it('resolves CPFP transactions to exit_fee even when flagged as board', () => {
    expect(getFeedRowSource(makeOnchainEntry({ isBoard: true, isCpfp: true }))).toBe('exit_fee')
  })

  it('resolves plain wallet transactions to onchain', () => {
    expect(getFeedRowSource(makeOnchainEntry())).toBe('onchain')
  })

  it('resolves board movement rows to ark', () => {
    expect(getFeedRowSource(makeMovementEntry({ kind: 'board', name: 'bark.board' }))).toBe('ark')
  })
})

describe(filterFeedByTab, () => {
  const boardTx = makeOnchainEntry({ isBoard: true })
  const plainTx = makeOnchainEntry({ txid: 'b'.repeat(64) })
  const cpfpTx = makeOnchainEntry({ isCpfp: true, txid: 'c'.repeat(64) })
  const boardMovement = makeMovementEntry({ kind: 'board', name: 'bark.board' })
  const exitMovement = makeMovementEntry({ kind: 'start-exit', name: 'bark.exit' })
  const feed = [boardTx, plainTx, cpfpTx, boardMovement, exitMovement]

  it('keeps every row in the all tab', () => {
    expect(filterFeedByTab(feed, 'all')).toStrictEqual(feed)
  })

  it('shows board funding transactions in the onchain tab', () => {
    expect(filterFeedByTab(feed, 'onchain')).toStrictEqual([boardTx, plainTx, cpfpTx, exitMovement])
  })

  it('shows board movements in the ark tab', () => {
    expect(filterFeedByTab(feed, 'ark')).toStrictEqual([boardMovement])
  })
})
