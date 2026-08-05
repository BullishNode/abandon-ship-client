import type { BlockRef } from '@/types/domain/chain'

export type ExitTxOrigin =
  | { type: 'wallet'; confirmedIn?: BlockRef | null }
  | { type: 'mempool' }
  | { type: 'block'; confirmedIn: BlockRef }

export type ExitTxStatus =
  | { type: 'verify-inputs' }
  | { type: 'awaiting-input-confirmation'; txids: string[] }
  | { type: 'awaiting-cpfp-broadcast' }
  | { type: 'awaiting-confirmation'; childTxid: string; origin: ExitTxOrigin }
  | { type: 'confirmed'; block: BlockRef; childTxid: string; origin: ExitTxOrigin }

export interface ExitTx {
  txid: string
  status: ExitTxStatus
}

export interface TransactionInfo {
  tx: string
  txid: string
}

export interface FeeInfo {
  feeRateSatPerKvb: number
  totalFeeSats: number
}

export interface ChildTransactionInfo {
  info: TransactionInfo
  feeInfo?: FeeInfo | null
  origin: ExitTxOrigin
}

export interface ExitTransactionPackage {
  exit: TransactionInfo
  child?: ChildTransactionInfo | null
}

export type ExitState =
  | { type: 'start'; tipHeight: number }
  | { type: 'processing'; tipHeight: number; transactions: ExitTx[] }
  | {
      type: 'awaiting-delta'
      tipHeight: number
      claimableHeight: number
      confirmedBlock: BlockRef
    }
  | {
      type: 'claimable'
      tipHeight: number
      claimableSince: BlockRef
      lastScannedBlock?: BlockRef
    }
  | {
      type: 'claim-in-progress'
      tipHeight: number
      claimTxid: string
      claimableSince: BlockRef
    }
  | { type: 'claimed'; tipHeight: number; block: BlockRef; txid: string }
  | { type: 'vtxo-already-spent'; tipHeight: number }
  | { type: 'canceled'; tipHeight: number }

export interface ExitTransactionStatus {
  vtxoId: string
  state: ExitState
  transactions?: ExitTransactionPackage[]
  history?: ExitState[] | null
}

export interface ExitStartResult {
  message: string
}

export interface ExitClaimResult {
  message: string
}
