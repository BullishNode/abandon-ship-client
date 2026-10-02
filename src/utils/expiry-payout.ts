import type { ExpiryPayout } from '@/types/domain/expiry-payout'

// Coins sent to the same Ark address share a key, so one payout output can be
// listed for several coins. Count each output once.
export function sumPayoutSats(payouts: ExpiryPayout[]): number {
  const amountByOutpoint = new Map(
    payouts.map((payout) => [`${payout.txid}:${payout.vout}`, payout.amountSats])
  )
  return [...amountByOutpoint.values()].reduce((total, amount) => total + amount, 0)
}
