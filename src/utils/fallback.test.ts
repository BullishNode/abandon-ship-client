import { Transaction } from 'bitcoinjs-lib'
import { describe, expect, it } from 'vitest'
import { createMovement } from '../../tests/fixtures/movements'
import { fallbackReceipt } from '@/utils/fallback'
import { getMovementDisplayBalanceSats, getMovementSource } from '@/utils/movement'
import { buildMovementsFeed, filterFeedByTab } from '@/utils/movements-feed'

function receipt(stage = 'committed') {
  return createMovement({
    effectiveBalanceSats: 0,
    metadata: {
      fallback: {
        chain_view_valid: true,
        forfeited_sat: 0,
        output_index: 0,
        payout_sat: 4500,
        stage,
        txid: null
      }
    },
    status: 'pending',
    subsystem: { kind: 'payout', name: 'abandon.fallback_payout' }
  })
}

describe('native fallback payout display', () => {
  it('shows an actual payout amount without inventing a second Ark debit for an unknown descendant', () => {
    const movement = receipt()
    expect(getMovementDisplayBalanceSats(movement)).toBe(4500)
    expect(movement.effectiveBalanceSats).toBe(0)
    expect(getMovementSource(movement)).toBe('fallback_payout')
    expect(fallbackReceipt(movement)?.stage).toBe('committed')
    expect(movement.status).toBe('pending')
    expect(filterFeedByTab([{ kind: 'movement', movement }], 'onchain')).toHaveLength(1)
  })

  it('refuses unknown stage metadata instead of calling it confirmed', () => {
    expect(fallbackReceipt(receipt('unknown_future_stage'))).toBeNull()
    const movement = receipt('awaiting_settlement')
    expect(fallbackReceipt(movement)?.stage).toBe('awaiting_settlement')
  })
  it('collapses a real matching incoming output only when the receipt covers the whole wallet transaction', () => {
    const tx = new Transaction()
    tx.addInput(new Uint8Array(32), 0)
    tx.addOutput(Uint8Array.from([0, 20, ...Array.from({ length: 20 }, () => 17)]), 4500n)
    tx.addOutput(Uint8Array.from([0, 20, ...Array.from({ length: 20 }, () => 18)]), 1000n)
    const movement = receipt('broadcast')
    movement.metadata = {
      fallback: {
        chain_view_valid: true,
        forfeited_sat: 0,
        output_index: 0,
        payout_sat: 4500,
        stage: 'broadcast',
        txid: tx.getId()
      }
    }
    const options = {
      network: 'regtest' as const,
      transactions: [{ balanceChangeSats: 4500, isCpfp: false, tx: tx.toHex(), txid: tx.getId() }],
      utxos: [{ amountSats: 4500, outpoint: `${tx.getId()}:0` }]
    }
    expect(buildMovementsFeed([movement], options)).toHaveLength(1)
    options.transactions[0].balanceChangeSats = 5500
    options.utxos.push({ amountSats: 1000, outpoint: `${tx.getId()}:1` })
    expect(buildMovementsFeed([movement], options)).toHaveLength(2)
    expect(movement.effectiveBalanceSats).toBe(0)
  })
})
