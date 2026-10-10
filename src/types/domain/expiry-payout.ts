// The Ark server's view of an expired coin: it may have paid the coin out
// on-chain instead of refreshing it.

export interface ServerVtxoStatus {
  vtxoId: string
  state: string
}
