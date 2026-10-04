import type { ExpiryPayout } from '@/types/domain/expiry-payout'
import type { WalletTx } from '@/types/domain/onchain'
import { decodeInputs } from '@/utils/tx-address'

// A restored wallet can sweep while this browser's payout lookup is unavailable.
// Its on-chain snapshot already includes the proceeds, so exclude the spent input.
export function unspentPayouts(payouts: ExpiryPayout[], transactions: WalletTx[]): ExpiryPayout[] {
  if (payouts.length === 0) {
    return payouts
  }
  const spent = new Set(
    transactions.flatMap(({ tx }) =>
      decodeInputs(tx).map(({ prevTxid, prevVout }) => `${prevTxid}:${prevVout}`)
    )
  )
  return payouts.filter(({ txid, vout }) => !spent.has(`${txid}:${vout}`))
}

// Coins sent to the same Ark address share a key, so one payout output can be
// listed for several coins. Count each output once.
export function sumPayoutSats(payouts: ExpiryPayout[]): number {
  const amountByOutpoint = new Map(
    payouts.map((payout) => [`${payout.txid}:${payout.vout}`, payout.amountSats])
  )
  return [...amountByOutpoint.values()].reduce((total, amount) => total + amount, 0)
}
