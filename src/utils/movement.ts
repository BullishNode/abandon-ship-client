import type { Movement, MovementDestination } from '@secondts/barkd'
import { formatAddress } from '@/utils/format'

export type MovementSource = 'onchain' | 'lightning' | 'ark' | 'unknown'

export function getMovementDirection(movement: Movement): 'incoming' | 'outgoing' {
  return movement.effectiveBalanceSat >= 0 ? 'incoming' : 'outgoing'
}

export function getMovementCounterpartyDestination(movement: Movement): MovementDestination | null {
  const direction = getMovementDirection(movement)
  if (direction === 'outgoing' && movement.sentTo.length > 0) {
    return movement.sentTo[0]
  }
  if (direction === 'incoming' && movement.receivedOn.length > 0) {
    return movement.receivedOn[0]
  }
  return null
}

export function getMovementCounterparty(movement: Movement): string {
  const destination = getMovementCounterpartyDestination(movement)
  if (destination) {
    return formatAddress(destination.destination.value)
  }
  return movement.subsystem.name
}

function sourceFromPaymentType(type: string): MovementSource | null {
  if (type === 'ark') {
    return 'ark'
  }
  if (type === 'bitcoin' || type === 'output-script') {
    return 'onchain'
  }
  if (type === 'invoice' || type === 'offer' || type === 'lightning-address') {
    return 'lightning'
  }
  return null
}

function sourceFromSubsystemName(name: string): MovementSource | null {
  const normalized = name.toLowerCase()
  if (normalized.includes('ark')) {
    return 'ark'
  }
  if (normalized.includes('lightning') || normalized === 'ln') {
    return 'lightning'
  }
  if (
    normalized.includes('onchain') ||
    normalized.includes('on-chain') ||
    normalized.includes('bitcoin')
  ) {
    return 'onchain'
  }
  return null
}

function isArkBridgeSubsystem(name: string): boolean {
  return name.toLowerCase().includes('offboard')
}

export function getMovementSource(movement: Movement): MovementSource {
  if (isArkBridgeSubsystem(movement.subsystem.name)) {
    return 'ark'
  }
  const destinations = [...movement.sentTo, ...movement.receivedOn]
  for (const destination of destinations) {
    const source = sourceFromPaymentType(destination.destination.type)
    if (source) {
      return source
    }
  }
  return sourceFromSubsystemName(movement.subsystem.name) ?? 'unknown'
}

// barkd Movement type currently exposes only offchainFeeSat. Onchain fees may
// live in `metadata` per subsystem; extend once the metadata schema is documented.
export function getMovementFeeSat(movement: Movement): number | null {
  if (typeof movement.offchainFeeSat === 'number') {
    return movement.offchainFeeSat
  }
  return null
}
