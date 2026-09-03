export interface FeeEstimate {
  feeSats: number
  grossAmountSats: number
  netAmountSats: number
  vtxosSpent: string[]
}

export interface EmergencyExitFeeEstimate {
  /** Paid now from confirmed on-chain funds to CPFP every unconfirmed exit tx. */
  exitBroadcastFeeSats: number
  /** Deducted later from the exited amount when the outputs are drained. */
  claimFeeSats: number
  totalFeeSats: number
  feeRateSatPerVb: number
  txsToBroadcast: number
  /** `false` when confirmed on-chain funds run out midway through the CPFP walk. */
  fundable: boolean
}

export interface OnchainFeeRates {
  fastSatPerVb: number
  regularSatPerVb: number
  slowSatPerVb: number
}

export interface PpmExpiryFeeEntry {
  expiryBlocksThreshold: number
  ppm: number
}

export interface BoardFees {
  baseFeeSats: number
  minFeeSats: number
  ppm: number
}

export interface OffboardFees {
  baseFeeSats: number
  fixedAdditionalVb: number
  ppmExpiryTable: PpmExpiryFeeEntry[]
}

export interface LightningReceiveFees {
  baseFeeSats: number
  ppm: number
}

export interface LightningSendFees {
  baseFeeSats: number
  minFeeSats: number
  ppmExpiryTable: PpmExpiryFeeEntry[]
}

export interface RefreshFees {
  baseFeeSats: number
  ppmExpiryTable: PpmExpiryFeeEntry[]
}

export interface FeeSchedule {
  board: BoardFees
  offboard: OffboardFees
  refresh: RefreshFees
  lightningReceive: LightningReceiveFees
  lightningSend: LightningSendFees
}
