import type { Movement, MovementDestination } from '@/types/domain/movement'

export const BASE_MOVEMENT: Movement = {
  createdAt: '2026-01-01T00:00:00.000Z',
  effectiveBalanceSats: 0,
  exitedVtxos: [],
  id: 1,
  inputVtxos: [],
  intendedBalanceSats: 0,
  offchainFeeSats: 0,
  outputVtxos: [],
  receivedOn: [],
  sentTo: [],
  status: 'successful',
  subsystem: { kind: 'ark', name: 'Ark' },
  updatedAt: '2026-01-01T00:00:00.000Z'
}

export function createMovement(overrides: Partial<Movement> = {}): Movement {
  return { ...BASE_MOVEMENT, ...overrides }
}

export function destination(
  paymentType: MovementDestination['paymentType'],
  value: string,
  amountSats = 0
): MovementDestination {
  return {
    amountSats,
    paymentType,
    value
  }
}
