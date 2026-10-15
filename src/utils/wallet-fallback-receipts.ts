import { address, Transaction } from 'bitcoinjs-lib'
import type { WalletTx } from '@/types/domain/onchain'
import type { Network } from '@/types/domain/network'
import { networkFor } from '@/utils/bitcoin'

export interface FallbackAddressReceipt {
  txid: string
  vout: number
  amountSats: number
  confirmationHeight: number
}

// This identifies receipts at one address, not their origin or their relation
// to an expired VTXO. Old fallback addresses and missing history remain unknown.
export function receiptsAtFallbackAddress(
  destination: string,
  network: Network,
  transactions: WalletTx[],
  tipHeight: number
): { receipts: FallbackAddressReceipt[]; totalSats: number; invalidTransactionIds: string[] } {
  if (!Number.isSafeInteger(tipHeight) || tipHeight < 0) throw new Error('Invalid chain tip')
  const expected = address.toOutputScript(destination, networkFor(network))
  const receipts = new Map<string, FallbackAddressReceipt>()
  const invalidTransactionIds: string[] = []
  for (const item of transactions) {
    try {
      const tx = Transaction.fromHex(item.tx)
      if (tx.getId() !== item.txid) throw new Error('Transaction id does not match bytes')
      if (item.confirmation === null || item.confirmation === undefined) continue
      const height = item.confirmation.height
      if (!Number.isSafeInteger(height) || height < 1 || height > tipHeight ||
          !/^[0-9a-f]{64}$/u.test(item.confirmation.hash)) throw new Error('Invalid confirmation')
      const matched: FallbackAddressReceipt[] = []
      tx.outs.forEach((output, vout) => {
        if (output.script.length !== expected.length ||
            !output.script.every((byte, index) => byte === expected[index])) return
        const amountSats = Number(output.value)
        if (!Number.isSafeInteger(amountSats) || amountSats < 0) throw new Error('Invalid amount')
        matched.push({ txid: item.txid, vout, amountSats, confirmationHeight: height })
      })
      for (const receipt of matched) receipts.set(`${receipt.txid}:${receipt.vout}`, receipt)
    } catch {
      invalidTransactionIds.push(item.txid)
    }
  }
  const totalSats = [...receipts.values()].reduce((total, receipt) => total + receipt.amountSats, 0)
  if (!Number.isSafeInteger(totalSats)) throw new Error('Receipt total exceeds safe arithmetic')
  return { receipts: [...receipts.values()], totalSats, invalidTransactionIds }
}
