import type { Movement, MovementDestination } from '@/types/domain/movement'
import type { WalletTx } from '@/types/domain/onchain'
import { formatAddress } from '@/utils/format'

export type MovementSource =
  | 'onchain'
  | 'lightning'
  | 'ark'
  | 'board'
  | 'exit'
  | 'exit_fee'
  | 'refresh'
  | 'expiry_payout'
  | 'unknown'

export function getMovementDirection(movement: Movement): 'incoming' | 'outgoing' {
  return movement.effectiveBalanceSats >= 0 ? 'incoming' : 'outgoing'
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
    return formatAddress(destination.value)
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

export function isRoundSubsystem(subsystem: Movement['subsystem']): boolean {
  return subsystem.name === 'bark.round'
}

export function isOffboardSubsystem(subsystem: Movement['subsystem']): boolean {
  if (subsystem.name === 'bark.offboard') {
    return true
  }
  return (
    isRoundSubsystem(subsystem) &&
    (subsystem.kind === 'offboard' || subsystem.kind === 'send_onchain')
  )
}

export function isArkToOnchainTransfer(subsystem: Movement['subsystem']): boolean {
  return isExitSubsystem(subsystem.name) || isOffboardSubsystem(subsystem)
}

export function isBoardSubsystem(subsystem: Movement['subsystem']): boolean {
  return subsystem.name === 'bark.board'
}

export function isFailedRoundMovement(movement: Movement): boolean {
  return movement.status === 'failed' && isRoundSubsystem(movement.subsystem)
}

export function getMovementDisplayBalanceSats(movement: Movement): number {
  return isFailedRoundMovement(movement) ? 0 : movement.effectiveBalanceSats
}

function txidFromOutpoint(outpoint: string): string | null {
  const [txid] = outpoint.split(':')
  return txid !== undefined && txid.length > 0 ? txid : null
}

export function getBoardFundingTxids(movements: Movement[]): Set<string> {
  const txids = new Set<string>()
  const boardMovements = movements.filter((movement) => isBoardSubsystem(movement.subsystem))
  for (const movement of boardMovements) {
    const chainAnchor: unknown = movement.metadata?.chain_anchor
    const anchorTxid = typeof chainAnchor === 'string' ? txidFromOutpoint(chainAnchor) : null
    if (anchorTxid !== null) {
      txids.add(anchorTxid)
      continue
    }
    for (const vtxoId of movement.outputVtxos) {
      const vtxoTxid = txidFromOutpoint(vtxoId)
      if (vtxoTxid !== null) {
        txids.add(vtxoTxid)
      }
    }
  }
  return txids
}

export function getMovementSource(movement: Movement): MovementSource {
  if (isExitSubsystem(movement.subsystem.name)) {
    return 'exit'
  }
  if (isBoardSubsystem(movement.subsystem)) {
    return 'ark'
  }
  if (movement.subsystem.kind === 'refresh') {
    return 'refresh'
  }
  // Recorded by the sweep of an expired coin the server paid out on-chain.
  if (movement.subsystem.kind === 'expiry-payout') {
    return 'expiry_payout'
  }
  const destinations = [...movement.sentTo, ...movement.receivedOn]
  for (const destination of destinations) {
    if (destination.paymentType === undefined) {
      continue
    }
    const source = sourceFromPaymentType(destination.paymentType)
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
 * exit-tree level, not as `offchainFeeSats` (which is 0). Those CPFP children
 * arrive as `isCpfp` wallet transactions; sum their fees to get the on-chain
 * exit cost. The total grows as more tree levels confirm, so it is recomputed
 * from the live transaction list rather than stored.
 */
export function sumExitCpfpFeeSat(transactions: WalletTx[]): number {
  return transactions
    .filter((tx) => tx.isCpfp && typeof tx.onchainFeeSats === 'number')
    .reduce((total, tx) => total + (tx.onchainFeeSats ?? 0), 0)
}

export function getMovementRawJson(movement: Movement): string {
  return JSON.stringify(movement, null, 2)
}

export function getMovementFeeSat(
  movement: Movement,
  transactions: WalletTx[] = []
): number | null {
  if (isFailedRoundMovement(movement)) {
    return 0
  }
  if (isExitSubsystem(movement.subsystem.name)) {
    return movement.offchainFeeSats + sumExitCpfpFeeSat(transactions)
  }
  if (typeof movement.offchainFeeSats === 'number') {
    return movement.offchainFeeSats
  }
  return null
}
