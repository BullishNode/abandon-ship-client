export type MovementsTab = 'all' | 'ark' | 'lightning' | 'onchain'

export interface PendingOffboard {
  txid: string
  createdAtMs: number
}
