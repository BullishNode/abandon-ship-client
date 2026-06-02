import type { BarkNetwork, Movement, MovementStatus, UtxoInfo, WalletTxInfo } from '@secondts/barkd'
import { AVERAGE_BLOCK_INTERVAL_MS } from '@/constants/btc'
import { decodeInputs, decodeOutputs } from '@/utils/tx-address'

export interface OnchainTxEntry {
  kind: 'onchain'
  txid: string
  status: MovementStatus
  amountSat: number
  direction: 'incoming' | 'outgoing'
  bindingAddress: string | undefined
  confirmationHeight: number | null
  approximateTimestampMs: number
  firstSeenMs: number | null
  feeSat: number | null
}

export interface MovementEntry {
  kind: 'movement'
  movement: Movement
}

export type MovementsFeedRow = MovementEntry | OnchainTxEntry

function makeOutpoint(txid: string, vout: number): string {
  return `${txid}:${vout}`
}

function firstSeenMs(txid: string, firstSeenAt: Record<string, string>): number | null {
  const iso = firstSeenAt[txid]
  if (iso === undefined) {
    return null
  }
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? null : ms
}

function approximateTimestampMs(
  confirmationHeight: number | null,
  tipHeight: number | undefined,
  firstSeen: number | null
): number {
  if (confirmationHeight === null || tipHeight === undefined || tipHeight < confirmationHeight) {
    return firstSeen ?? Date.now()
  }
  const elapsedBlocks = tipHeight - confirmationHeight
  return Date.now() - elapsedBlocks * AVERAGE_BLOCK_INTERVAL_MS
}

function buildOwnedOutpoints(transactions: WalletTxInfo[], utxos: UtxoInfo[]): Set<string> {
  const ownedOutpoints = new Set<string>()
  for (const utxo of utxos) {
    ownedOutpoints.add(utxo.outpoint)
  }
  const ourTxids = new Set(transactions.map((tx) => tx.txid))
  for (const tx of transactions) {
    for (const input of decodeInputs(tx.tx)) {
      if (ourTxids.has(input.prevTxid)) {
        ownedOutpoints.add(makeOutpoint(input.prevTxid, input.prevVout))
      }
    }
  }
  return ownedOutpoints
}

function findBindingAddress(
  tx: WalletTxInfo,
  ownedOutpoints: Set<string>,
  direction: 'incoming' | 'outgoing',
  network: BarkNetwork
): string | undefined {
  const lookForOwned = direction === 'incoming'
  for (const out of decodeOutputs(tx.tx, network)) {
    const isOwned = ownedOutpoints.has(makeOutpoint(tx.txid, out.vout))
    if (isOwned === lookForOwned && out.address !== undefined) {
      return out.address
    }
  }
  return undefined
}

interface BuildOnchainOptions {
  tipHeight?: number
  network: BarkNetwork
  firstSeenAt?: Record<string, string>
}

export function buildOnchainTxEntries(
  transactions: WalletTxInfo[],
  utxos: UtxoInfo[],
  options: BuildOnchainOptions
): OnchainTxEntry[] {
  const ownedOutpoints = buildOwnedOutpoints(transactions, utxos)
  const firstSeenAt = options.firstSeenAt ?? {}
  const entries: OnchainTxEntry[] = []
  for (const tx of transactions) {
    const amountSat = tx.balanceChangeSat
    const direction: 'incoming' | 'outgoing' = amountSat >= 0 ? 'incoming' : 'outgoing'
    const confirmationHeight = tx.confirmation?.height ?? null
    const status: MovementStatus = confirmationHeight === null ? 'pending' : 'successful'
    const firstSeen = firstSeenMs(tx.txid, firstSeenAt)
    entries.push({
      amountSat,
      approximateTimestampMs: approximateTimestampMs(
        confirmationHeight,
        options.tipHeight,
        firstSeen
      ),
      bindingAddress: findBindingAddress(tx, ownedOutpoints, direction, options.network),
      confirmationHeight,
      direction,
      feeSat: tx.onchainFeeSat ?? null,
      firstSeenMs: firstSeen,
      kind: 'onchain',
      status,
      txid: tx.txid
    })
  }
  return entries
}

function rowTimestampMs(row: MovementsFeedRow): number {
  if (row.kind === 'movement') {
    return row.movement.time.createdAt.getTime()
  }
  return row.approximateTimestampMs
}

function rowTieBreak(row: MovementsFeedRow): number {
  if (row.kind === 'movement') {
    return row.movement.time.createdAt.getTime()
  }
  if (row.firstSeenMs !== null) {
    return row.firstSeenMs
  }
  return row.confirmationHeight ?? 0
}

function compareRows(a: MovementsFeedRow, b: MovementsFeedRow): number {
  const byTimestamp = rowTimestampMs(b) - rowTimestampMs(a)
  if (byTimestamp !== 0) {
    return byTimestamp
  }
  return rowTieBreak(b) - rowTieBreak(a)
}

interface BuildFeedOptions {
  tipHeight?: number
  transactions?: WalletTxInfo[]
  utxos?: UtxoInfo[]
  network?: BarkNetwork
  firstSeenAt?: Record<string, string>
}

export function buildMovementsFeed(
  movements: Movement[],
  options: BuildFeedOptions = {}
): MovementsFeedRow[] {
  const movementEntries: MovementsFeedRow[] = movements.map((movement) => ({
    kind: 'movement',
    movement
  }))
  let onchainEntries: MovementsFeedRow[] = []
  if (options.network !== undefined && options.transactions !== undefined) {
    onchainEntries = buildOnchainTxEntries(options.transactions, options.utxos ?? [], {
      firstSeenAt: options.firstSeenAt,
      network: options.network,
      tipHeight: options.tipHeight
    })
  }
  const combined = [...movementEntries, ...onchainEntries]
  combined.sort(compareRows)
  return combined
}
