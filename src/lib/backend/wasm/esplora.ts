import { z } from 'zod'
import { config } from '@/config/runtime'
import type { OnchainFeeRates } from '@/types/domain/fees'
import type { Utxo, WalletTx } from '@/types/domain/onchain'
import { esploraUrl } from '@/utils/chain-source'

// The WASM bindings expose no tip / utxo / onchain-transaction / fee-rate
// endpoints, so we hit the same esplora REST service the wallet syncs against.
// chainSource is esplora-compatible for both supported networks and both
// return `Access-Control-Allow-Origin: *`, so browser-direct requests work.

function esploraBase(): string {
  return esploraUrl(config.chainSource).replace(/\/+$/u, '')
}

async function esploraGet(path: string): Promise<Response> {
  const response = await fetch(`${esploraBase()}${path}`)
  if (!response.ok) {
    throw new Error(`esplora ${path} failed: ${response.status}`)
  }
  return response
}

export async function fetchTip(): Promise<number> {
  const response = await esploraGet('/blocks/tip/height')
  const text = await response.text()
  const height = Number.parseInt(text.trim(), 10)
  if (Number.isNaN(height)) {
    throw new TypeError(`esplora tip returned non-numeric height: ${text}`)
  }
  return height
}

const FAST_TARGETS = ['1', '2']
const REGULAR_TARGETS = ['3', '6']
const SLOW_TARGETS = ['144', '504', '1008']
const FALLBACK_FEE_SAT_PER_VB = 1

const feeEstimatesSchema = z.record(z.string(), z.number())

function pickFeeRate(estimates: Record<string, number>, targets: string[]): number {
  for (const target of targets) {
    const rate = estimates[target]
    if (typeof rate === 'number' && rate > 0) {
      return Math.ceil(rate)
    }
  }
  return FALLBACK_FEE_SAT_PER_VB
}

export async function fetchFeeRates(): Promise<OnchainFeeRates> {
  const response = await esploraGet('/fee-estimates')
  const estimates = feeEstimatesSchema.parse(await response.json())
  const fast = pickFeeRate(estimates, FAST_TARGETS)
  const regular = pickFeeRate(estimates, REGULAR_TARGETS)
  const slow = pickFeeRate(estimates, SLOW_TARGETS)
  return {
    fastSatPerVb: fast,
    regularSatPerVb: Math.min(regular, fast),
    slowSatPerVb: Math.min(slow, regular, fast)
  }
}

// Remote esplora JSON is validated rather than cast: a proxy error page or an
// incompatible deployment should fail loudly here, not as a TypeError deeper in
// the mapping code.
const esploraUtxoSchema = z.object({
  status: z.object({ block_height: z.number().optional(), confirmed: z.boolean() }),
  txid: z.string(),
  value: z.number(),
  vout: z.number()
})

const esploraUtxosSchema = z.array(esploraUtxoSchema)

async function fetchAddressUtxos(address: string): Promise<Utxo[]> {
  const response = await esploraGet(`/address/${address}/utxo`)
  const utxos = esploraUtxosSchema.parse(await response.json())
  return utxos.map((utxo) => ({
    amountSats: utxo.value,
    confirmationHeight: utxo.status.confirmed ? (utxo.status.block_height ?? null) : null,
    outpoint: `${utxo.txid}:${utxo.vout}`
  }))
}

// One request per known address against a public esplora: a single failed
// address must not blank the whole result set, so failures are skipped — the
// wallet balance remains authoritative for totals.
async function settledFlat<T>(tasks: Promise<T[]>[]): Promise<T[][]> {
  const settled = await Promise.allSettled(tasks)
  return settled
    .filter((result): result is PromiseFulfilledResult<T[]> => result.status === 'fulfilled')
    .map((result) => result.value)
}

// Query esplora for every address the onchain wallet has handed out. The bark
// OnchainWallet does not expose its full address set (including internal change
// addresses), so this reflects funds on known receive addresses; the
// authoritative spendable total still comes from OnchainWallet.balance().
export async function fetchUtxos(addresses: string[]): Promise<Utxo[]> {
  const results = await settledFlat(addresses.map(fetchAddressUtxos))
  const seen = new Set<string>()
  const utxos: Utxo[] = []
  for (const list of results) {
    for (const utxo of list) {
      if (seen.has(utxo.outpoint)) {
        continue
      }
      seen.add(utxo.outpoint)
      utxos.push(utxo)
    }
  }
  return utxos
}

const esploraTxSchema = z.object({
  fee: z.number().optional(),
  status: z.object({
    block_hash: z.string().optional(),
    block_height: z.number().optional(),
    confirmed: z.boolean()
  }),
  txid: z.string(),
  vin: z.array(
    z.object({
      prevout: z
        .object({ scriptpubkey_address: z.string().optional(), value: z.number() })
        .nullable(),
      txid: z.string(),
      vout: z.number()
    })
  ),
  vout: z.array(z.object({ scriptpubkey_address: z.string().optional(), value: z.number() }))
})

const esploraTxsSchema = z.array(esploraTxSchema)

type EsploraTx = z.infer<typeof esploraTxSchema>

function balanceChangeForTx(tx: EsploraTx, owned: Set<string>): number {
  let received = 0
  let sent = 0
  for (const out of tx.vout) {
    if (out.scriptpubkey_address !== undefined && owned.has(out.scriptpubkey_address)) {
      received += out.value
    }
  }
  for (const input of tx.vin) {
    const prev = input.prevout
    if (prev?.scriptpubkey_address !== undefined && owned.has(prev.scriptpubkey_address)) {
      sent += prev.value
    }
  }
  return received - sent
}

// Esplora pages confirmed history: `/address/:a/txs` returns the mempool set
// plus the 25 most recent confirmed txs, and `/txs/chain/:last_seen` pages
// through the rest, 25 at a time. Follow the pages (bounded) or history is
// silently truncated for active addresses.
const CONFIRMED_PAGE_SIZE = 25
const MAX_TX_PAGES = 20

async function fetchTxPage(address: string, lastSeenTxid: string | null): Promise<EsploraTx[]> {
  const path =
    lastSeenTxid === null
      ? `/address/${address}/txs`
      : `/address/${address}/txs/chain/${lastSeenTxid}`
  const response = await esploraGet(path)
  return esploraTxsSchema.parse(await response.json())
}

async function fetchAddressTxs(address: string): Promise<EsploraTx[]> {
  const first = await fetchTxPage(address, null)
  const txs = [...first]
  // Chain pages contain only confirmed txs; the first page mixes in mempool.
  let confirmedPage = first.filter((tx) => tx.status.confirmed)
  let pages = 1
  while (confirmedPage.length >= CONFIRMED_PAGE_SIZE && pages < MAX_TX_PAGES) {
    const lastSeenTxid = confirmedPage.at(-1)?.txid
    if (lastSeenTxid === undefined) {
      break
    }
    confirmedPage = await fetchTxPage(address, lastSeenTxid)
    txs.push(...confirmedPage)
    pages += 1
  }
  return txs
}

// Best-effort onchain history from esplora over the known address set. Balance
// change is computed against that set. Raw-tx hex is not available from this
// path, so `tx` is empty and the tx graph is forwarded pre-decoded via
// `outputs`/`inputs` — esplora returns both structurally, so consumers needing
// output addresses or spent outpoints do not depend on the hex. CPFP detection
// needs ancestor analysis and stays unavailable, so `isCpfp` is false. The
// wallet balance remains authoritative for totals.
export async function fetchTransactions(addresses: string[]): Promise<WalletTx[]> {
  const owned = new Set(addresses)
  const results = await settledFlat(addresses.map(fetchAddressTxs))
  const byTxid = new Map<string, EsploraTx>()
  for (const list of results) {
    for (const tx of list) {
      byTxid.set(tx.txid, tx)
    }
  }
  const transactions: WalletTx[] = []
  for (const tx of byTxid.values()) {
    transactions.push({
      balanceChangeSats: balanceChangeForTx(tx, owned),
      confirmation:
        tx.status.confirmed && tx.status.block_height !== undefined
          ? { hash: tx.status.block_hash ?? '', height: tx.status.block_height }
          : null,
      inputs: tx.vin.map((input) => ({ prevTxid: input.txid, prevVout: input.vout })),
      isCpfp: false,
      onchainFeeSats: tx.fee ?? null,
      outputs: tx.vout.map((out, vout) => ({
        address: out.scriptpubkey_address,
        valueSat: out.value,
        vout
      })),
      tx: '',
      txid: tx.txid
    })
  }
  return transactions
}
