import type { Movement } from '@secondts/barkd'
import { formatAddress } from '@/utils/format'

export function getMovementDirection(movement: Movement): 'incoming' | 'outgoing' {
  return movement.effectiveBalanceSat >= 0 ? 'incoming' : 'outgoing'
}

export function getMovementCounterparty(movement: Movement): string {
  const direction = getMovementDirection(movement)

  if (direction === 'outgoing' && movement.sentTo.length > 0) {
    return formatAddress(movement.sentTo[0].destination.value)
  }

  if (direction === 'incoming' && movement.receivedOn.length > 0) {
    return formatAddress(movement.receivedOn[0].destination.value)
  }

  return movement.subsystem.name
}
