import type { ExitTransactionStatus, WalletVtxoInfo } from '@secondts/barkd'
import type { TFunction } from 'i18next'
import { AVERAGE_BLOCK_INTERVAL_MS } from '@/constants/btc'
import { formatRelativeTime } from '@/utils/relative-time'

export type VtxoStatus = WalletVtxoInfo['state']['type']

export type VtxoExitDisplay = 'exiting' | 'exited'

export function mapVtxoExitDisplays(exits: ExitTransactionStatus[]): Map<string, VtxoExitDisplay> {
  const displays = new Map<string, VtxoExitDisplay>()
  for (const exit of exits) {
    displays.set(exit.vtxoId, exit.state.type === 'claimed' ? 'exited' : 'exiting')
  }
  return displays
}

export function sortVtxosForDisplay(
  vtxos: WalletVtxoInfo[],
  exitDisplayById: Map<string, VtxoExitDisplay>
): WalletVtxoInfo[] {
  return [...vtxos].toSorted((a, b) => {
    const aExited = exitDisplayById.get(a.id) === 'exited'
    const bExited = exitDisplayById.get(b.id) === 'exited'
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
