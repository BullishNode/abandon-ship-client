import type { Movement, MovementStatus, UtxoInfo } from '@secondts/barkd'
import { AVERAGE_BLOCK_INTERVAL_MS } from '@/constants/btc'

export interface OnchainEntry {
  kind: 'onchain'
  outpoint: string
  txid: string
  voutIndex: number
  amountSat: number
  confirmationHeight: number | null
  status: MovementStatus
  approximateTimestampMs: number
}

export interface MovementEntry {
  kind: 'movement'
  movement: Movement
}

export type MovementsFeedRow = MovementEntry | OnchainEntry

function parseOutpoint(outpoint: string): { txid: string; voutIndex: number } {
  const [txid = '', vout = ''] = outpoint.split(':')
  const parsedIndex = Number.parseInt(vout, 10)
  return {
    txid,
    voutIndex: Number.isNaN(parsedIndex) ? 0 : parsedIndex
  }
}

function approximateUtxoTimestampMs(utxo: UtxoInfo, tipHeight: number | undefined): number {
  if (utxo.confirmationHeight === null || utxo.confirmationHeight === undefined) {
    return Date.now()
  }
  if (tipHeight === undefined || tipHeight < utxo.confirmationHeight) {
    return Date.now()
  }
  const elapsedBlocks = tipHeight - utxo.confirmationHeight
  return Date.now() - elapsedBlocks * AVERAGE_BLOCK_INTERVAL_MS
}

export function utxoToOnchainEntry(utxo: UtxoInfo, tipHeight: number | undefined): OnchainEntry {
  const { txid, voutIndex } = parseOutpoint(utxo.outpoint)
  const isConfirmed = utxo.confirmationHeight !== null && utxo.confirmationHeight !== undefined
  return {
    amountSat: utxo.amountSat,
    approximateTimestampMs: approximateUtxoTimestampMs(utxo, tipHeight),
    confirmationHeight: utxo.confirmationHeight ?? null,
    kind: 'onchain',
    outpoint: utxo.outpoint,
    status: isConfirmed ? 'successful' : 'pending',
    txid,
    voutIndex
  }
}

function rowTimestampMs(row: MovementsFeedRow): number {
  if (row.kind === 'movement') {
    return row.movement.time.createdAt.getTime()
  }
  return row.approximateTimestampMs
}

export function buildMovementsFeed(
  movements: Movement[],
  utxos: UtxoInfo[],
  tipHeight: number | undefined
): MovementsFeedRow[] {
  const movementEntries: MovementsFeedRow[] = movements.map((movement) => ({
    kind: 'movement',
    movement
  }))
  const onchainEntries: MovementsFeedRow[] = utxos.map((utxo) =>
    utxoToOnchainEntry(utxo, tipHeight)
  )
  const combined = [...movementEntries, ...onchainEntries]
  combined.sort((a, b) => rowTimestampMs(b) - rowTimestampMs(a))
  return combined
}
