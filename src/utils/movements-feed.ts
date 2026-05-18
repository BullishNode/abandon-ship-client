import type {
  BarkNetwork,
  Movement,
  MovementStatus,
  TransactionInfo,
  UtxoInfo
} from '@secondts/barkd'
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
}

export interface MovementEntry {
  kind: 'movement'
  movement: Movement
}

export type MovementsFeedRow = MovementEntry | OnchainTxEntry

function makeOutpoint(txid: string, vout: number): string {
  return `${txid}:${vout}`
}

function approximateTimestampMs(
  confirmationHeight: number | null,
  tipHeight: number | undefined
): number {
  if (confirmationHeight === null) {
    return Date.now()
  }
  if (tipHeight === undefined || tipHeight < confirmationHeight) {
    return Date.now()
  }
  const elapsedBlocks = tipHeight - confirmationHeight
  return Date.now() - elapsedBlocks * AVERAGE_BLOCK_INTERVAL_MS
}

function indexUtxosByTxid(utxos: UtxoInfo[]): Map<string, UtxoInfo[]> {
  const byTxid = new Map<string, UtxoInfo[]>()
  for (const utxo of utxos) {
    const [txid = ''] = utxo.outpoint.split(':')
    const bucket = byTxid.get(txid)
    if (bucket === undefined) {
      byTxid.set(txid, [utxo])
    } else {
      bucket.push(utxo)
    }
  }
  return byTxid
}

interface OwnedOutpointMap {
  ownedOutpoints: Set<string>
  outputValueByOutpoint: Map<string, number>
}

function buildOwnedOutpointMap(
  transactions: TransactionInfo[],
  utxos: UtxoInfo[],
  network: BarkNetwork
): OwnedOutpointMap {
  const ownedOutpoints = new Set<string>()
  const outputValueByOutpoint = new Map<string, number>()
  for (const utxo of utxos) {
    ownedOutpoints.add(utxo.outpoint)
  }
  const ourTxids = new Set(transactions.map((tx) => tx.txid))
  for (const tx of transactions) {
    const outputs = decodeOutputs(tx.tx, network)
    for (const out of outputs) {
      const outpoint = makeOutpoint(tx.txid, out.vout)
      outputValueByOutpoint.set(outpoint, out.valueSat)
    }
    const inputs = decodeInputs(tx.tx)
    for (const input of inputs) {
      if (ourTxids.has(input.prevTxid)) {
        ownedOutpoints.add(makeOutpoint(input.prevTxid, input.prevVout))
      }
    }
  }
  return { outputValueByOutpoint, ownedOutpoints }
}

function txStatus(utxoBucket: UtxoInfo[] | undefined): {
  status: MovementStatus
  confirmationHeight: number | null
} {
  if (utxoBucket === undefined || utxoBucket.length === 0) {
    return { confirmationHeight: null, status: 'successful' }
  }
  let maxHeight: number | null = null
  let anyUnconfirmed = false
  for (const utxo of utxoBucket) {
    const height = utxo.confirmationHeight ?? null
    if (height === null) {
      anyUnconfirmed = true
    } else if (maxHeight === null || height > maxHeight) {
      maxHeight = height
    }
  }
  if (anyUnconfirmed) {
    return { confirmationHeight: maxHeight, status: 'pending' }
  }
  return { confirmationHeight: maxHeight, status: 'successful' }
}

interface BuildOnchainOptions {
  tipHeight?: number
  network: BarkNetwork
}

export function buildOnchainTxEntries(
  transactions: TransactionInfo[],
  utxos: UtxoInfo[],
  options: BuildOnchainOptions
): OnchainTxEntry[] {
  const owned = buildOwnedOutpointMap(transactions, utxos, options.network)
  const utxosByTxid = indexUtxosByTxid(utxos)
  const entries: OnchainTxEntry[] = []
  for (const tx of transactions) {
    const outputs = decodeOutputs(tx.tx, options.network)
    const inputs = decodeInputs(tx.tx)

    let outputsToUsSat = 0
    for (const out of outputs) {
      const outpoint = makeOutpoint(tx.txid, out.vout)
      if (owned.ownedOutpoints.has(outpoint)) {
        outputsToUsSat += out.valueSat
      }
    }

    let inputsFromUsSat = 0
    for (const input of inputs) {
      const prevOutpoint = makeOutpoint(input.prevTxid, input.prevVout)
      if (owned.ownedOutpoints.has(prevOutpoint)) {
        inputsFromUsSat += owned.outputValueByOutpoint.get(prevOutpoint) ?? 0
      }
    }

    const amountSat = outputsToUsSat - inputsFromUsSat
    const direction: 'incoming' | 'outgoing' = amountSat >= 0 ? 'incoming' : 'outgoing'

    const lookForOwned = direction === 'incoming'
    let bindingAddress: string | undefined
    for (const out of outputs) {
      const outpoint = makeOutpoint(tx.txid, out.vout)
      const isOwned = owned.ownedOutpoints.has(outpoint)
      if (isOwned === lookForOwned && out.address !== undefined) {
        bindingAddress = out.address
        break
      }
    }

    const { status, confirmationHeight } = txStatus(utxosByTxid.get(tx.txid))
    entries.push({
      amountSat,
      approximateTimestampMs: approximateTimestampMs(confirmationHeight, options.tipHeight),
      bindingAddress,
      confirmationHeight,
      direction,
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

interface BuildFeedOptions {
  tipHeight?: number
  transactions?: TransactionInfo[]
  utxos?: UtxoInfo[]
  network?: BarkNetwork
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
      network: options.network,
      tipHeight: options.tipHeight
    })
  }
  const combined = [...movementEntries, ...onchainEntries]
  combined.sort((a, b) => rowTimestampMs(b) - rowTimestampMs(a))
  return combined
}
