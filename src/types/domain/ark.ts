import type { FeeSchedule } from '@/types/domain/fees'

export interface ArkInfo {
  network: string
  serverPubkey: string
  roundInterval: string
  nbRoundNonces: number
  vtxoExitDelta: number
  vtxoExpiryDelta: number
  htlcExpiryDelta: number
  htlcSendExpiryDelta: number
  maxUserInvoiceCltvDelta: number
  maxVtxoExitDepth: number
  minBoardAmountSats: number
  requiredBoardConfirmations: number
  lnReceiveAntiDosRequired: boolean
  // Optional: not exposed by the WASM backend. barkd always supplies these.
  mailboxPubkey?: string
  maxVtxoAmountSats?: number
  offboardFeerateSatPerKvb?: number
  fees: FeeSchedule
}
