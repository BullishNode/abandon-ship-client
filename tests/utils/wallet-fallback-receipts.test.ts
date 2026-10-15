import { address, networks, Transaction } from 'bitcoinjs-lib'
import { describe, expect, it } from 'vitest'
import type { WalletTx } from '@/types/domain/onchain'
import { receiptsAtFallbackAddress } from '@/utils/wallet-fallback-receipts'
const destination = address.toBech32(new Uint8Array(20).fill(1), 0, 'tb')
const other = address.toBech32(new Uint8Array(20).fill(2), 0, 'tb')
function received(amount = 1000n, to = destination): WalletTx {
  const tx = new Transaction()
  tx.addInput(new Uint8Array(32).fill(3), 0)
  tx.addOutput(address.toOutputScript(to, networks.testnet), amount)
  return { txid: tx.getId(), tx: tx.toHex(), balanceChangeSats: Number(amount), isCpfp: false,
    confirmation: { height: 90, hash: 'ab'.repeat(32) } }
}
const scan = (transactions: WalletTx[]) => receiptsAtFallbackAddress(destination, 'signet', transactions, 100)

describe(receiptsAtFallbackAddress, () => {
  it('reports a confirmed address receipt with no expired-coin or sender attribution', () => {
    const item = received()
    expect(scan([item])).toStrictEqual({ receipts: [{ txid: item.txid, vout: 0, amountSats: 1000, confirmationHeight: 90 }], totalSats: 1000, invalidTransactionIds: [] })
    expect(scan([item]).receipts[0]).not.toHaveProperty('vtxoId')
  })
  it('deduplicates the same outpoint', () => {
    const item = received()
    expect(scan([item, item]).totalSats).toBe(1000)
  })
  it('does not treat an unconfirmed transaction as a confirmed receipt', () => {
    expect(scan([{ ...received(), confirmation: null }]).receipts).toStrictEqual([])
  })
  it('does not claim receipts at another or historical address are absent', () => {
    expect(scan([received(1000n, other)]).receipts).toStrictEqual([])
  })
  it('flags mismatched raw bytes instead of assigning them to a stated txid', () => {
    const item = { ...received(), txid: 'ff'.repeat(32) }
    expect(scan([item])).toStrictEqual({ receipts: [], totalSats: 0, invalidTransactionIds: [item.txid] })
  })
  it.each([0, 101, 1.5])('flags invalid or future confirmation height %s', (height) => {
    const item = received(); item.confirmation = { height, hash: 'ab'.repeat(32) }
    expect(scan([item]).invalidTransactionIds).toStrictEqual([item.txid])
    expect(scan([item]).totalSats).toBe(0)
  })
  it('flags malformed history instead of proving zero recovered funds', () => {
    const item = { ...received(), tx: 'broken' }
    expect(scan([item]).invalidTransactionIds).toStrictEqual([item.txid])
  })
  it('refuses invalid chain context', () => {
    expect(() => receiptsAtFallbackAddress(destination, 'signet', [], -1)).toThrow()
  })
})
