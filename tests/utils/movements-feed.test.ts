import { Transaction } from 'bitcoinjs-lib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildMovementsFeed,
  buildOnchainTxEntries,
  filterFeedByTab,
  getFeedRowSource
} from '../../src/utils/movements-feed'
import { createMovement } from '../fixtures/movements'
import type { Utxo, WalletTx } from '@/types/domain/onchain'

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function p2wpkhScript(hexProgram: string): Uint8Array {
  const program = hexToBytes(hexProgram)
  const script = new Uint8Array(2 + program.length)
  script[0] = 0x00
  script[1] = program.length
  script.set(program, 2)
  return script
}

function reverseBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[bytes.length - 1 - i]
  }
  return out
}

const DUMMY_PREVOUT = '0000000000000000000000000000000000000000000000000000000000000001'

function buildRawTx(
  inputs: { prevTxid: string; prevVout: number }[],
  outputs: { valueSat: number; programHex: string }[]
): string {
  const tx = new Transaction()
  tx.version = 2
  const effectiveInputs = inputs.length === 0 ? [{ prevTxid: DUMMY_PREVOUT, prevVout: 0 }] : inputs
  for (const input of effectiveInputs) {
    const hash = reverseBytes(hexToBytes(input.prevTxid))
    tx.addInput(hash, input.prevVout)
  }
  for (const output of outputs) {
    tx.addOutput(p2wpkhScript(output.programHex), BigInt(output.valueSat))
  }
  return tx.toHex()
}

function deriveTxid(rawTxHex: string): string {
  return Transaction.fromHex(rawTxHex).getId()
}

function makeUtxo(outpoint: string, overrides: Partial<Utxo> = {}): Utxo {
  return {
    amountSats: 1000,
    confirmationHeight: null,
    outpoint,
    ...overrides
  }
}

function makeTx(tx: string, txid: string, overrides: Partial<WalletTx> = {}): WalletTx {
  return { balanceChangeSats: 0, isCpfp: false, tx, txid, ...overrides }
}

const REGTEST_PROGRAM_A = '0000000000000000000000000000000000000001'
const REGTEST_PROGRAM_B = '0000000000000000000000000000000000000002'

describe(buildMovementsFeed, () => {
  const NOW = new Date('2026-05-13T00:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty when no movements or onchain data', () => {
    expect(buildMovementsFeed([])).toStrictEqual([])
  })

  it('sorts movements by descending timestamp', () => {
    const older = createMovement({
      createdAt: new Date('2026-01-01').toISOString(),
      id: 1,
      updatedAt: new Date('2026-01-01').toISOString()
    })
    const newer = createMovement({
      createdAt: new Date('2026-05-01').toISOString(),
      id: 2,
      updatedAt: new Date('2026-05-01').toISOString()
    })
    const result = buildMovementsFeed([older, newer])
    expect(result).toMatchObject([
      { kind: 'movement', movement: { id: 2 } },
      { kind: 'movement', movement: { id: 1 } }
    ])
  })

  it('interleaves movements with onchain entries by timestamp', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const transactions: WalletTx[] = [makeTx(rawTx, txid)]
    const utxo = makeUtxo(`${txid}:0`, { amountSats: 1000, confirmationHeight: 100 })
    const movement = createMovement({ createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() })
    const result = buildMovementsFeed([movement], {
      network: 'regtest',
      tipHeight: 110,
      transactions,
      utxos: [utxo]
    })
    expect(result).toHaveLength(2)
    expect(result.some((row) => row.kind === 'movement')).toBeTruthy()
    expect(result.some((row) => row.kind === 'onchain')).toBeTruthy()
  })

  it('orders two pending onchain txs by first-seen time, newest first', () => {
    const txA = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txidA = deriveTxid(txA)
    const txB = buildRawTx([], [{ programHex: REGTEST_PROGRAM_B, valueSat: 2000 }])
    const txidB = deriveTxid(txB)
    const transactions: WalletTx[] = [
      makeTx(txA, txidA, { balanceChangeSats: 1000 }),
      makeTx(txB, txidB, { balanceChangeSats: 2000 })
    ]
    const result = buildMovementsFeed([], {
      firstSeenAt: {
        [txidA]: '2026-05-12T10:00:00Z',
        [txidB]: '2026-05-12T10:05:00Z'
      },
      network: 'regtest',
      transactions
    })
    const txids = result.flatMap((row) => (row.kind === 'onchain' ? [row.txid] : []))
    expect(txids).toStrictEqual([txidB, txidA])
  })

  it('breaks same-block confirmed ties by first-seen time', () => {
    const txA = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txidA = deriveTxid(txA)
    const txB = buildRawTx([], [{ programHex: REGTEST_PROGRAM_B, valueSat: 2000 }])
    const txidB = deriveTxid(txB)
    const transactions: WalletTx[] = [
      makeTx(txA, txidA, { balanceChangeSats: 1000, confirmation: { hash: 'b', height: 100 } }),
      makeTx(txB, txidB, { balanceChangeSats: 2000, confirmation: { hash: 'b', height: 100 } })
    ]
    const result = buildMovementsFeed([], {
      firstSeenAt: {
        [txidA]: '2026-05-12T10:00:00Z',
        [txidB]: '2026-05-12T10:05:00Z'
      },
      network: 'regtest',
      tipHeight: 110,
      transactions
    })
    const txids = result.flatMap((row) => (row.kind === 'onchain' ? [row.txid] : []))
    expect(txids).toStrictEqual([txidB, txidA])
  })

  it('hides refresh movements when hideRefresh is set', () => {
    const refresh = createMovement({ id: 1, subsystem: { kind: 'refresh', name: 'Ark' } })
    const exit = createMovement({ id: 2, subsystem: { kind: 'exit', name: 'Ark' } })
    const result = buildMovementsFeed([refresh, exit], { hideRefresh: true })
    expect(result).toMatchObject([{ kind: 'movement', movement: { id: 2 } }])
  })

  it('hides cpfp exit-fee onchain txs when hideExitFee is set', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const transactions: WalletTx[] = [makeTx(rawTx, txid, { isCpfp: true })]
    const result = buildMovementsFeed([], {
      hideExitFee: true,
      network: 'regtest',
      transactions
    })
    expect(result).toStrictEqual([])
  })

  it('keeps API order for pending txs without first-seen data', () => {
    const txA = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txidA = deriveTxid(txA)
    const txB = buildRawTx([], [{ programHex: REGTEST_PROGRAM_B, valueSat: 2000 }])
    const txidB = deriveTxid(txB)
    const transactions: WalletTx[] = [
      makeTx(txA, txidA, { balanceChangeSats: 1000 }),
      makeTx(txB, txidB, { balanceChangeSats: 2000 })
    ]
    const result = buildMovementsFeed([], {
      network: 'regtest',
      transactions
    })
    const txids = result.flatMap((row) => (row.kind === 'onchain' ? [row.txid] : []))
    expect(txids).toStrictEqual([txidA, txidB])
  })
})

describe(buildOnchainTxEntries, () => {
  const NOW = new Date('2026-05-13T00:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('classifies pure receive as incoming with positive amount', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 50_000 }])
    const txid = deriveTxid(rawTx)
    const utxo = makeUtxo(`${txid}:0`, { amountSats: 50_000, confirmationHeight: null })
    const entries = buildOnchainTxEntries(
      [makeTx(rawTx, txid, { balanceChangeSats: 50_000 })],
      [utxo],
      {
        network: 'regtest'
      }
    )
    expect(entries).toHaveLength(1)
    expect(entries[0].direction).toBe('incoming')
    expect(entries[0].amountSat).toBe(50_000)
    expect(entries[0].status).toBe('pending')
    expect(entries[0].bindingAddress).toBeDefined()
  })

  it('classifies send-with-change as outgoing with negative net', () => {
    const fundingTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 100_000 }])
    const fundingTxid = deriveTxid(fundingTx)
    const sendTx = buildRawTx(
      [{ prevTxid: fundingTxid, prevVout: 0 }],
      [
        { programHex: REGTEST_PROGRAM_B, valueSat: 60_000 },
        { programHex: REGTEST_PROGRAM_A, valueSat: 39_000 }
      ]
    )
    const sendTxid = deriveTxid(sendTx)
    const transactions: WalletTx[] = [
      makeTx(fundingTx, fundingTxid, {
        balanceChangeSats: 100_000,
        confirmation: { hash: 'block-100', height: 100 }
      }),
      makeTx(sendTx, sendTxid, {
        balanceChangeSats: -61_000,
        confirmation: { hash: 'block-200', height: 200 },
        onchainFeeSats: 1234
      })
    ]
    const changeUtxo = makeUtxo(`${sendTxid}:1`, { amountSats: 39_000, confirmationHeight: 200 })
    const entries = buildOnchainTxEntries(transactions, [changeUtxo], {
      network: 'regtest',
      tipHeight: 210
    })
    const sendEntry = entries.find((entry) => entry.txid === sendTxid)
    expect(sendEntry).toBeDefined()
    expect(sendEntry?.direction).toBe('outgoing')
    expect(sendEntry?.amountSat).toBe(-61_000)
    expect(sendEntry?.status).toBe('successful')
    expect(sendEntry?.confirmationHeight).toBe(200)
    expect(sendEntry?.feeSat).toBe(1234)
  })

  it('exposes feeSat from tx.onchainFeeSats, null when unknown', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const [withFee] = buildOnchainTxEntries([makeTx(rawTx, txid, { onchainFeeSats: 250 })], [], {
      network: 'regtest'
    })
    const [withoutFee] = buildOnchainTxEntries([makeTx(rawTx, txid)], [], {
      network: 'regtest'
    })
    expect(withFee.feeSat).toBe(250)
    expect(withoutFee.feeSat).toBeNull()
  })

  it('propagates isCpfp from tx.isCpfp', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const [cpfp] = buildOnchainTxEntries([makeTx(rawTx, txid, { isCpfp: true })], [], {
      network: 'regtest'
    })
    const [plain] = buildOnchainTxEntries([makeTx(rawTx, txid)], [], {
      network: 'regtest'
    })
    expect(cpfp.isCpfp).toBeTruthy()
    expect(plain.isCpfp).toBeFalsy()
  })

  it('marks status pending when the tx is unconfirmed', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const utxo = makeUtxo(`${txid}:0`, { amountSats: 1000, confirmationHeight: null })
    const entries = buildOnchainTxEntries([makeTx(rawTx, txid, { confirmation: null })], [utxo], {
      network: 'regtest'
    })
    expect(entries[0].status).toBe('pending')
    expect(entries[0].confirmationHeight).toBeNull()
  })

  it('marks status successful when the tx is confirmed', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const entries = buildOnchainTxEntries(
      [makeTx(rawTx, txid, { confirmation: { hash: 'block-300', height: 300 } })],
      [],
      { network: 'regtest' }
    )
    expect(entries[0].status).toBe('successful')
    expect(entries[0].confirmationHeight).toBe(300)
  })

  it('uses the first-seen time as the timestamp for pending txs', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const seenMs = new Date('2026-05-10T00:00:00Z').getTime()
    const [entry] = buildOnchainTxEntries([makeTx(rawTx, txid)], [], {
      firstSeenAt: { [txid]: '2026-05-10T00:00:00Z' },
      network: 'regtest'
    })
    expect(entry.firstSeenMs).toBe(seenMs)
    expect(entry.approximateTimestampMs).toBe(seenMs)
  })

  it('prefers first-seen over the block-height estimate for confirmed txs', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const seenMs = new Date('2026-05-12T23:59:00Z').getTime()
    const [entry] = buildOnchainTxEntries(
      [makeTx(rawTx, txid, { confirmation: { hash: 'tip', height: 100 } })],
      [],
      {
        firstSeenAt: { [txid]: '2026-05-12T23:59:00Z' },
        network: 'regtest',
        tipHeight: 100
      }
    )
    expect(entry.approximateTimestampMs).toBe(seenMs)
  })

  it('falls back to now for the timestamp when no first-seen time exists', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const [entry] = buildOnchainTxEntries([makeTx(rawTx, txid)], [], {
      network: 'regtest'
    })
    expect(entry.firstSeenMs).toBeNull()
    expect(entry.approximateTimestampMs).toBe(NOW.getTime())
  })
})

// The WASM esplora backend has no raw-tx hex and forwards the tx graph
// pre-decoded instead. Without that, `decodeOutputs('')` fails silently and
// every onchain row loses its binding address, so labels and tags never render.
describe('pre-decoded tx graph (hex-less backends)', () => {
  const ADDRESS_A = 'bcrt1qaddressa'
  const ADDRESS_B = 'bcrt1qaddressb'

  it('resolves an incoming binding address from outputs when tx hex is empty', () => {
    const txid = 'a'.repeat(64)
    const transactions: WalletTx[] = [
      makeTx('', txid, {
        balanceChangeSats: 50_000,
        outputs: [{ address: ADDRESS_A, valueSat: 50_000, vout: 0 }]
      })
    ]
    const [entry] = buildOnchainTxEntries(transactions, [makeUtxo(`${txid}:0`)], {
      network: 'regtest'
    })
    expect(entry.direction).toBe('incoming')
    expect(entry.bindingAddress).toBe(ADDRESS_A)
  })

  it('resolves an outgoing binding address as the unowned output', () => {
    const txid = 'b'.repeat(64)
    const transactions: WalletTx[] = [
      makeTx('', txid, {
        balanceChangeSats: -61_000,
        outputs: [
          { address: ADDRESS_B, valueSat: 60_000, vout: 0 },
          { address: ADDRESS_A, valueSat: 39_000, vout: 1 }
        ]
      })
    ]
    const changeUtxo = makeUtxo(`${txid}:1`, { amountSats: 39_000 })
    const [entry] = buildOnchainTxEntries(transactions, [changeUtxo], { network: 'regtest' })
    expect(entry.direction).toBe('outgoing')
    expect(entry.bindingAddress).toBe(ADDRESS_B)
  })

  it('treats a spent parent output as owned via pre-decoded inputs', () => {
    const fundingTxid = 'c'.repeat(64)
    const spendTxid = 'd'.repeat(64)
    // The funding output is spent, so it is absent from the utxo set. Only the
    // spend's inputs reveal that vout 0 belonged to the wallet, which is what
    // makes the funding tx resolve as incoming rather than unowned.
    const transactions: WalletTx[] = [
      makeTx('', fundingTxid, {
        balanceChangeSats: 100_000,
        outputs: [{ address: ADDRESS_A, valueSat: 100_000, vout: 0 }]
      }),
      makeTx('', spendTxid, {
        balanceChangeSats: -100_000,
        inputs: [{ prevTxid: fundingTxid, prevVout: 0 }],
        outputs: [{ address: ADDRESS_B, valueSat: 99_000, vout: 0 }]
      })
    ]
    const entries = buildOnchainTxEntries(transactions, [], { network: 'regtest' })
    const funding = entries.find((entry) => entry.txid === fundingTxid)
    expect(funding?.bindingAddress).toBe(ADDRESS_A)
  })

  it('leaves the binding address undefined when neither hex nor outputs exist', () => {
    const txid = 'e'.repeat(64)
    const [entry] = buildOnchainTxEntries([makeTx('', txid, { balanceChangeSats: 1000 })], [], {
      network: 'regtest'
    })
    expect(entry.bindingAddress).toBeUndefined()
  })

  it('prefers pre-decoded outputs over the raw hex when both are present', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const [entry] = buildOnchainTxEntries(
      [
        makeTx(rawTx, txid, {
          balanceChangeSats: 1000,
          outputs: [{ address: ADDRESS_A, valueSat: 1000, vout: 0 }]
        })
      ],
      [makeUtxo(`${txid}:0`)],
      { network: 'regtest' }
    )
    expect(entry.bindingAddress).toBe(ADDRESS_A)
  })

  it('still decodes from hex when the pre-decoded fields are absent', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 50_000 }])
    const txid = deriveTxid(rawTx)
    const [entry] = buildOnchainTxEntries(
      [makeTx(rawTx, txid, { balanceChangeSats: 50_000 })],
      [makeUtxo(`${txid}:0`, { amountSats: 50_000 })],
      { network: 'regtest' }
    )
    expect(entry.bindingAddress).toBeDefined()
    expect(entry.bindingAddress).not.toBe(ADDRESS_A)
  })

  it('does not re-parse hex when outputs is an explicit empty array', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const [entry] = buildOnchainTxEntries(
      [makeTx(rawTx, txid, { balanceChangeSats: 1000, outputs: [] })],
      [makeUtxo(`${txid}:0`)],
      { network: 'regtest' }
    )
    expect(entry.bindingAddress).toBeUndefined()
  })
})

describe(getFeedRowSource, () => {
  it('classifies a refresh movement row as refresh', () => {
    const movement = createMovement({ id: 1, subsystem: { kind: 'refresh', name: 'bark.round' } })
    expect(getFeedRowSource({ kind: 'movement', movement })).toBe('refresh')
  })

  it('classifies a cpfp onchain row as exit_fee', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const [entry] = buildOnchainTxEntries([makeTx(rawTx, txid, { isCpfp: true })], [], {
      network: 'regtest'
    })
    expect(getFeedRowSource(entry)).toBe('exit_fee')
  })

  it('classifies a plain onchain row as onchain', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const [entry] = buildOnchainTxEntries([makeTx(rawTx, txid)], [], {
      network: 'regtest'
    })
    expect(getFeedRowSource(entry)).toBe('onchain')
  })
})

describe(filterFeedByTab, () => {
  it('includes refresh rows under the ark tab', () => {
    const ark = createMovement({ id: 1, subsystem: { kind: 'arkoor', name: 'bark.ark' } })
    const refresh = createMovement({ id: 2, subsystem: { kind: 'refresh', name: 'bark.round' } })
    const feed = buildMovementsFeed([ark, refresh])
    expect(filterFeedByTab(feed, 'ark')).toHaveLength(2)
  })

  it('includes exit_fee rows under the onchain tab', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const feed = buildMovementsFeed([], {
      network: 'regtest',
      transactions: [makeTx(rawTx, txid, { isCpfp: true })]
    })
    expect(filterFeedByTab(feed, 'onchain')).toHaveLength(1)
  })
})
