import type { OnchainBalance } from '@/types/domain/balance'
import type { BlockRef } from '@/types/domain/chain'

export interface Utxo {
  outpoint: string
  amountSats: number
  confirmationHeight?: number | null
}

export interface DecodedOutput {
  vout: number
  address: string | undefined
  valueSat: number
}

export interface DecodedInput {
  prevTxid: string
  prevVout: number
}

export interface OnchainSnapshot {
  balance: OnchainBalance
  transactions: WalletTx[]
  utxos: Utxo[]
}

export interface WalletTx {
  txid: string
  tx: string
  // Net change to the wallet's balance: received - sent over wallet-owned outputs.
  balanceChangeSats: number
  confirmation?: BlockRef | null
  isCpfp: boolean
  onchainFeeSats?: number | null
  outputs?: DecodedOutput[]
  inputs?: DecodedInput[]
}
