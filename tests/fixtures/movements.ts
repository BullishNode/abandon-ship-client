import type { Movement, MovementDestination } from '@secondts/barkd'

export const BASE_MOVEMENT: Movement = {
  effectiveBalanceSat: 0,
  exitedVtxos: [],
  id: 1,
  inputVtxos: [],
  intendedBalanceSat: 0,
  offchainFeeSat: 0,
  outputVtxos: [],
  receivedOn: [],
  sentTo: [],
  status: 'successful',
  subsystem: { kind: 'ark', name: 'Ark' },
  time: { createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z') }
}

export function createMovement(overrides: Partial<Movement> = {}): Movement {
  return { ...BASE_MOVEMENT, ...overrides }
}

export function destination(
  type: MovementDestination['destination']['type'],
  value: string,
  amountSat = 0
): MovementDestination {
  return {
    amountSat,
    destination: { type, value }
  }
}
