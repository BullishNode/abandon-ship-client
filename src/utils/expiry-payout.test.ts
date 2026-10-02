import { describe, expect, it } from 'vitest'
import { sumPayoutSats } from './expiry-payout'

const TXID = 'a'.repeat(64)

describe(sumPayoutSats, () => {
  it('counts an output listed for two coins of one key once', () => {
    const payouts = [
      { amountSats: 50_000, txid: TXID, vout: 0, vtxoId: 'coin-a' },
      { amountSats: 50_000, txid: TXID, vout: 0, vtxoId: 'coin-b' },
      { amountSats: 20_000, txid: TXID, vout: 1, vtxoId: 'coin-c' }
    ]
    expect(sumPayoutSats(payouts)).toBe(70_000)
  })
})
