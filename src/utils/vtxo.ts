import type { ExitTransactionStatus, Movement, WalletVtxoInfo } from '@secondts/barkd'
import type { TFunction } from 'i18next'
import { AVERAGE_BLOCK_INTERVAL_MS } from '@/constants/btc'
import type { ExitStateType } from '@/utils/exit-progress'
import { formatRelativeTime } from '@/utils/relative-time'
import { truncateMiddleChars } from '@/utils/truncate-middle'

export type VtxoStatus = WalletVtxoInfo['state']['type']

export type VtxoExitPhase = ExitStateType

export type VtxoExitState = 'exiting' | 'exited'

const EXIT_SUBSYSTEM_NAME = 'bark.exit'

export function isExitedPhase(phase: VtxoExitPhase): boolean {
  return phase === 'claimed'
}

export function mapExitedVtxoIds(movements: Movement[]): Set<string> {
  const ids = new Set<string>()
  for (const movement of movements) {
    if (movement.subsystem.name !== EXIT_SUBSYSTEM_NAME) {
      continue
    }
    for (const id of movement.inputVtxos) {
      ids.add(id)
    }
  }
  return ids
}

export function mapVtxoExitStates(
  vtxos: WalletVtxoInfo[],
  exitPhaseById: Map<string, VtxoExitPhase>,
  exitedVtxoIds: Set<string>
): Map<string, VtxoExitState> {
  const states = new Map<string, VtxoExitState>()
  for (const vtxo of vtxos) {
    const phase = exitPhaseById.get(vtxo.id)
    if (phase !== undefined) {
      states.set(vtxo.id, isExitedPhase(phase) ? 'exited' : 'exiting')
      continue
    }
    if (exitedVtxoIds.has(vtxo.id) && vtxo.state.type === 'spent') {
      states.set(vtxo.id, 'exited')
    }
  }
  return states
}

export function isClaimAddressEditable(phase: VtxoExitPhase, hasClaimAddress: boolean): boolean {
  if (phase === 'start' || phase === 'processing' || phase === 'awaiting-delta') {
    return true
  }
  return phase === 'claimable' && !hasClaimAddress
}

export function mapVtxoExitPhases(exits: ExitTransactionStatus[]): Map<string, VtxoExitPhase> {
  const phases = new Map<string, VtxoExitPhase>()
  for (const exit of exits) {
    phases.set(exit.vtxoId, exit.state.type)
  }
  return phases
}

export function mapVtxoExitClaimHeights(exits: ExitTransactionStatus[]): Map<string, number> {
  const heights = new Map<string, number>()
  for (const exit of exits) {
    if (exit.state.type === 'claimed') {
      heights.set(exit.vtxoId, exit.state.block.height)
    }
  }
  return heights
}

export function sortVtxosForDisplay(
  vtxos: WalletVtxoInfo[],
  exitStateById: Map<string, VtxoExitState>,
  exitClaimHeightById: Map<string, number>
): WalletVtxoInfo[] {
  return [...vtxos].toSorted((a, b) => {
    const aExited = exitStateById.get(a.id) === 'exited'
    const bExited = exitStateById.get(b.id) === 'exited'
    if (aExited !== bExited) {
      return Number(aExited) - Number(bExited)
    }
    if (aExited && bExited) {
      const aHeight = exitClaimHeightById.get(a.id) ?? 0
      const bHeight = exitClaimHeightById.get(b.id) ?? 0
      return bHeight - aHeight
    }
    return a.expiryHeight - b.expiryHeight
  })
}

export function isSpendable(vtxo: WalletVtxoInfo): boolean {
  return vtxo.state.type === 'spendable'
}

export function getSpendableVtxos(vtxos: WalletVtxoInfo[]): WalletVtxoInfo[] {
  return vtxos.filter(isSpendable)
}

export function sumVtxoAmount(vtxos: WalletVtxoInfo[]): number {
  return vtxos.reduce((total, vtxo) => total + vtxo.amountSat, 0)
}

export function truncateVtxoId(id: string): string {
  const [txid, vout] = id.split(':')
  if (vout === undefined) {
    return id
  }
  return `${truncateMiddleChars(txid)}:${vout}`
}

export function getExpiryTimeLabel(expiryHeight: number, t: TFunction, tipHeight?: number): string {
  if (tipHeight === undefined) {
    return ''
  }
  const remaining = expiryHeight - tipHeight
  if (remaining <= 0) {
    return t('vtxos.expiry.expired')
  }
  const expiryDate = new Date(Date.now() + remaining * AVERAGE_BLOCK_INTERVAL_MS)
  return formatRelativeTime(expiryDate).replace(/\d/u, (digit) => `~${digit}`)
}

export function getVtxoRawJson(vtxo: WalletVtxoInfo): string {
  return JSON.stringify(vtxo, null, 2)
}

function getVtxoLockReasonKey(subsystem: Movement['subsystem']): string | null {
  const { name, kind } = subsystem
  if (name === 'bark.exit') {
    return 'exiting'
  }
  if (name === 'bark.lightning_send') {
    return 'sending_lightning'
  }
  if (name === 'bark.lightning_receive') {
    return 'receiving_lightning'
  }
  if (name === 'bark.offboard') {
    return 'sending_onchain'
  }
  if (name === 'bark.arkoor') {
    return kind === 'send' ? 'sending_ark' : null
  }
  if (name === 'bark.round') {
    if (kind === 'refresh') {
      return 'refreshing'
    }
    if (kind === 'offboard' || kind === 'send_onchain') {
      return 'sending_onchain'
    }
    return null
  }
  return null
}

export function mapVtxoLockLabels(
  vtxos: WalletVtxoInfo[],
  movements: Movement[],
  t: TFunction
): Map<string, string> {
  const movementById = new Map(movements.map((movement) => [movement.id, movement]))
  const labels = new Map<string, string>()
  for (const vtxo of vtxos) {
    if (vtxo.state.type !== 'locked' || vtxo.state.movementId === undefined) {
      continue
    }
    const movement = movementById.get(vtxo.state.movementId)
    if (movement === undefined) {
      continue
    }
    const reasonKey = getVtxoLockReasonKey(movement.subsystem)
    if (reasonKey === null) {
      continue
    }
    labels.set(vtxo.id, t(`vtxos.status.lock.${reasonKey}`))
  }
  return labels
}
