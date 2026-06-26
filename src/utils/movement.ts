import type { Movement, MovementDestination, WalletTxInfo } from '@secondts/barkd'
import { formatAddress } from '@/utils/format'

export type MovementSource = 'onchain' | 'lightning' | 'ark' | 'exit' | 'unknown'

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

export function isExitSubsystem(name: string): boolean {
  return name === 'bark.exit'
}

export function getMovementSource(movement: Movement): MovementSource {
  if (isExitSubsystem(movement.subsystem.name)) {
    return 'exit'
  }
  const destinations = [...movement.sentTo, ...movement.receivedOn]
  for (const destination of destinations) {
    const source = sourceFromPaymentType(destination.destination.type)
    if (source) {
      return source
    }
  }
  if (isArkBridgeSubsystem(movement.subsystem.name)) {
    return 'ark'
  }
  return sourceFromSubsystemName(movement.subsystem.name) ?? 'unknown'
}

/**
 * An exit pays its real cost as on-chain CPFP fees that barkd attaches to each
 * exit-tree level, not as `offchainFeeSat` (which is 0). Those CPFP children
 * arrive as `isCpfp` wallet transactions; sum their fees to get the on-chain
 * exit cost. The total grows as more tree levels confirm, so it is recomputed
 * from the live transaction list rather than stored.
 */
export function sumExitCpfpFeeSat(transactions: WalletTxInfo[]): number {
  return transactions
    .filter((tx) => tx.isCpfp && typeof tx.onchainFeeSat === 'number')
    .reduce((total, tx) => total + (tx.onchainFeeSat ?? 0), 0)
}

export function getMovementRawJson(movement: Movement): string {
  return JSON.stringify(movement, null, 2)
}

export function getMovementFeeSat(
  movement: Movement,
  transactions: WalletTxInfo[] = []
): number | null {
  if (isExitSubsystem(movement.subsystem.name)) {
    return movement.offchainFeeSat + sumExitCpfpFeeSat(transactions)
  }
  if (typeof movement.offchainFeeSat === 'number') {
    return movement.offchainFeeSat
  }
  return null
}
