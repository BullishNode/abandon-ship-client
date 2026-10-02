import type { ExpiryPayout, ServerVtxoState } from '@/types/domain/expiry-payout'

const SERVER_VTXO_STATES: readonly ServerVtxoState[] = ['spent', 'spendable', 'unregistered']

export function toServerVtxoState(value: unknown): ServerVtxoState {
  return SERVER_VTXO_STATES.find((state) => state === value) ?? 'other'
}

// Coins sent to the same Ark address share a key, so one payout output can be
// listed for several coins. Count each output once.
export function sumPayoutSats(payouts: ExpiryPayout[]): number {
  const amountByOutpoint = new Map(
    payouts.map((payout) => [`${payout.txid}:${payout.vout}`, payout.amountSats])
  )
  let total = 0
  for (const amount of amountByOutpoint.values()) {
    total += amount
  }
  return total
}
