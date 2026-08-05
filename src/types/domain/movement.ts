export const PAYMENT_TYPES = [
  'ark',
  'bitcoin',
  'output-script',
  'invoice',
  'offer',
  'lightning-address',
  'lnurl',
  'custom'
] as const

export type PaymentType = (typeof PAYMENT_TYPES)[number]

export type MovementStatus = 'pending' | 'successful' | 'failed' | 'canceled'

export interface MovementDestination {
  amountSats: number
  // Optional: getMovementSource infers from the subsystem name when this is
  // absent (see src/utils/movement.ts).
  paymentType?: PaymentType
  value: string
}

export interface MovementSubsystem {
  name: string
  kind: string
}

export interface Movement {
  id: number
  status: MovementStatus
  subsystem: MovementSubsystem
  sentTo: MovementDestination[]
  receivedOn: MovementDestination[]
  inputVtxos: string[]
  outputVtxos: string[]
  exitedVtxos: string[]
  intendedBalanceSats: number
  effectiveBalanceSats: number
  offchainFeeSats: number
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}
