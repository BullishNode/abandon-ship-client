import type { ExitTransactionStatus, WalletVtxoInfo } from '@secondts/barkd'
import type { TFunction } from 'i18next'
import { AVERAGE_BLOCK_INTERVAL_MS } from '@/constants/btc'
import type { ExitStateType } from '@/utils/exit-progress'
import { formatRelativeTime } from '@/utils/relative-time'

export type VtxoStatus = WalletVtxoInfo['state']['type']

export type VtxoExitPhase = ExitStateType

export function isExitedPhase(phase: VtxoExitPhase): boolean {
  return phase === 'claimed'
}

export function mapVtxoExitPhases(exits: ExitTransactionStatus[]): Map<string, VtxoExitPhase> {
  const phases = new Map<string, VtxoExitPhase>()
  for (const exit of exits) {
    phases.set(exit.vtxoId, exit.state.type)
  }
  return phases
}

export function sortVtxosForDisplay(
  vtxos: WalletVtxoInfo[],
  exitPhaseById: Map<string, VtxoExitPhase>
): WalletVtxoInfo[] {
  return [...vtxos].toSorted((a, b) => {
    const aPhase = exitPhaseById.get(a.id)
    const bPhase = exitPhaseById.get(b.id)
    const aExited = aPhase !== undefined && isExitedPhase(aPhase)
    const bExited = bPhase !== undefined && isExitedPhase(bPhase)
    if (aExited !== bExited) {
      return Number(aExited) - Number(bExited)
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
  return `${txid.slice(0, 8)}…${txid.slice(-8)}:${vout}`
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
