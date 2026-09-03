export interface CreateWalletParams {
  mnemonic: string
  birthdayHeight?: number | null
  restore?: boolean
}

export interface CreateWalletResult {
  fingerprint: string
  scanIncomplete?: boolean
}

export interface WalletExists {
  fingerprint?: string | null
}

export interface DeleteWalletParams {
  fingerprint: string
  dangerous: boolean
}

export interface DeleteWalletResult {
  deleted: boolean
  message: string
}

export interface SendParams {
  destination: string
  amountSats?: number | null
  comment?: string | null
}

export interface SendResult {
  message: string
}

export interface OnchainSendParams {
  destination: string
  amountSats: number
}

export interface OnchainSendResult {
  txid: string
}

export interface OffboardResult {
  // Null when the backend cannot report the funding txid (the WASM bindings'
  // offboard returns an opaque round-status string that may carry no txid).
  offboardTxid: string | null
}

export interface LightningInvoiceParams {
  amountSats: number
  description?: string | null
}

export interface LightningInvoice {
  invoice: string
}

export interface ExitStartVtxosParams {
  vtxos: string[]
}

export interface EmergencyExitFeeParams {
  /** Empty list prices the whole wallet. */
  vtxos: string[]
  feeRateSatPerVb?: number
  destination?: string
}

export interface ExitClaimVtxosParams {
  destination: string
  vtxos: string[]
  feeRate?: number | null
}

export interface UpdateMetadataParams {
  id: number
  metadata: Record<string, unknown>
}
