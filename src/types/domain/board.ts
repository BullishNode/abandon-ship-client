export interface PendingBoard {
  amountSats: number
  // Txid of the funding transaction that must confirm onchain for the board
  // to succeed.
  fundingTxid: string
  // IDs of the VTXOs created by this board (currently always length 1).
  vtxos: string[]
}
