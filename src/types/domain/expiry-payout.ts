// An expired coin the Ark server paid out on-chain to BIP86 tr(coin key)
// instead of refreshing it.

export interface ServerVtxoStatus {
  vtxoId: string
  state: string
}

// An unspent on-chain output paying a coin's key: what a sweep spends.
export interface ExpiryPayout {
  // A shared key may not identify which historical coin was paid.
  vtxoId: string | null
  txid: string
  vout: number
  amountSats: number
  // Exact deduction for this output; unknown for older or unavailable receipts.
  feeSats?: number | null
}

export interface ExpiryPayoutSweep {
  txid: string
  sweptSats: number
}
