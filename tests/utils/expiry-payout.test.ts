import { describe, expect, it } from 'vitest'
import { sumPayoutFees, sumPayoutSats } from '@/utils/expiry-payout'

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

describe(sumPayoutFees, () => {
  it('counts a shared-key output fee once and sums only distinct outputs', () => {
    const output = { amountSats: 49_850, feeSats: 150, txid: TXID, vout: 0, vtxoId: null }
    expect(sumPayoutFees([output, output, { ...output, feeSats: 151, vout: 1 }])).toBe(301)
    expect(sumPayoutFees([output, { ...output, feeSats: null, vout: 1 }])).toBeNull()
    expect(sumPayoutFees([{ ...output, feeSats: undefined }])).toBeNull()
  })
})
