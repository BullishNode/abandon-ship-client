import type { Movement } from '@secondts/barkd'
import { describe, expect, it } from 'vitest'
import { createMovement } from '../../tests/fixtures/movements'
import { getBoardFundingTxids, getMovementSource, isBoardSubsystem } from './movement'

const FUNDING_TXID = 'a'.repeat(64)
const OTHER_TXID = 'b'.repeat(64)

function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return createMovement({ subsystem: { kind: 'board', name: 'bark.board' }, ...overrides })
}

describe(isBoardSubsystem, () => {
  it('matches the bark.board subsystem name', () => {
    expect(isBoardSubsystem({ kind: 'board', name: 'bark.board' })).toBeTruthy()
  })

  it('rejects other subsystems even when the kind is board', () => {
    expect(isBoardSubsystem({ kind: 'board', name: 'bark.round' })).toBeFalsy()
    expect(isBoardSubsystem({ kind: 'offboard', name: 'bark.offboard' })).toBeFalsy()
    expect(isBoardSubsystem({ kind: 'exit', name: 'bark.exit' })).toBeFalsy()
  })
})

describe(getBoardFundingTxids, () => {
  it('extracts the txid from metadata.chain_anchor', () => {
    const movement = makeMovement({ metadata: { chain_anchor: `${FUNDING_TXID}:0` } })
    expect(getBoardFundingTxids([movement])).toStrictEqual(new Set([FUNDING_TXID]))
  })

  it('prefers chain_anchor over output VTXO IDs when both are present', () => {
    const movement = makeMovement({
      metadata: { chain_anchor: `${FUNDING_TXID}:0` },
      outputVtxos: [`${OTHER_TXID}:1`]
    })
    expect(getBoardFundingTxids([movement])).toStrictEqual(new Set([FUNDING_TXID]))
  })

  it('falls back to output VTXO IDs when chain_anchor is missing', () => {
    const movement = makeMovement({ outputVtxos: [`${FUNDING_TXID}:1`] })
    expect(getBoardFundingTxids([movement])).toStrictEqual(new Set([FUNDING_TXID]))
  })

  it('falls back to output VTXO IDs when chain_anchor is not a string', () => {
    const movement = makeMovement({
      metadata: { chain_anchor: 42 },
      outputVtxos: [`${FUNDING_TXID}:1`]
    })
    expect(getBoardFundingTxids([movement])).toStrictEqual(new Set([FUNDING_TXID]))
  })

  it('ignores non-board movements', () => {
    const movement = makeMovement({
      metadata: { chain_anchor: `${FUNDING_TXID}:0` },
      subsystem: { kind: 'exit', name: 'bark.exit' }
    })
    expect(getBoardFundingTxids([movement])).toStrictEqual(new Set())
  })

  it('includes failed board movements', () => {
    const movement = makeMovement({
      metadata: { chain_anchor: `${FUNDING_TXID}:0` },
      status: 'failed'
    })
    expect(getBoardFundingTxids([movement])).toStrictEqual(new Set([FUNDING_TXID]))
  })

  it('skips empty and malformed outpoints', () => {
    const movement = makeMovement({
      metadata: { chain_anchor: ':0' },
      outputVtxos: ['']
    })
    expect(getBoardFundingTxids([movement])).toStrictEqual(new Set())
  })

  it('collects txids across multiple board movements', () => {
    const first = makeMovement({ metadata: { chain_anchor: `${FUNDING_TXID}:0` } })
    const second = makeMovement({ id: 2, metadata: { chain_anchor: `${OTHER_TXID}:0` } })
    expect(getBoardFundingTxids([first, second])).toStrictEqual(new Set([FUNDING_TXID, OTHER_TXID]))
  })
})

describe(getMovementSource, () => {
  it('resolves board movements to ark', () => {
    expect(getMovementSource(makeMovement())).toBe('ark')
  })

  it('resolves exit movements to exit', () => {
    const movement = makeMovement({ subsystem: { kind: 'start-exit', name: 'bark.exit' } })
    expect(getMovementSource(movement)).toBe('exit')
  })

  it('resolves refresh movements to refresh', () => {
    const movement = makeMovement({ subsystem: { kind: 'refresh', name: 'bark.round' } })
    expect(getMovementSource(movement)).toBe('refresh')
  })
})
