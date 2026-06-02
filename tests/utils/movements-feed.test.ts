import { BarkNetwork } from '@secondts/barkd'
import type { UtxoInfo, WalletTxInfo } from '@secondts/barkd'
import { Transaction } from 'bitcoinjs-lib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMovementsFeed, buildOnchainTxEntries } from '../../src/utils/movements-feed'
import { createMovement } from '../fixtures/movements'

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

function makeUtxo(outpoint: string, overrides: Partial<UtxoInfo> = {}): UtxoInfo {
  return {
    amountSat: 1000,
    confirmationHeight: null,
    outpoint,
    ...overrides
  }
}

function makeTx(tx: string, txid: string, overrides: Partial<WalletTxInfo> = {}): WalletTxInfo {
  return { balanceChangeSat: 0, tx, txid, ...overrides }
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
      id: 1,
      time: { createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') }
    })
    const newer = createMovement({
      id: 2,
      time: { createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01') }
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
    const transactions: WalletTxInfo[] = [makeTx(rawTx, txid)]
    const utxo = makeUtxo(`${txid}:0`, { amountSat: 1000, confirmationHeight: 100 })
    const movement = createMovement({ time: { createdAt: NOW, updatedAt: NOW } })
    const result = buildMovementsFeed([movement], {
      network: BarkNetwork.Regtest,
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
    const transactions: WalletTxInfo[] = [
      makeTx(txA, txidA, { balanceChangeSat: 1000 }),
      makeTx(txB, txidB, { balanceChangeSat: 2000 })
    ]
    const result = buildMovementsFeed([], {
      firstSeenAt: {
        [txidA]: '2026-05-12T10:00:00Z',
        [txidB]: '2026-05-12T10:05:00Z'
      },
      network: BarkNetwork.Regtest,
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
    const transactions: WalletTxInfo[] = [
      makeTx(txA, txidA, { balanceChangeSat: 1000, confirmation: { hash: 'b', height: 100 } }),
      makeTx(txB, txidB, { balanceChangeSat: 2000, confirmation: { hash: 'b', height: 100 } })
    ]
    const result = buildMovementsFeed([], {
      firstSeenAt: {
        [txidA]: '2026-05-12T10:00:00Z',
        [txidB]: '2026-05-12T10:05:00Z'
      },
      network: BarkNetwork.Regtest,
      tipHeight: 110,
      transactions
    })
    const txids = result.flatMap((row) => (row.kind === 'onchain' ? [row.txid] : []))
    expect(txids).toStrictEqual([txidB, txidA])
  })

  it('keeps API order for pending txs without first-seen data', () => {
    const txA = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txidA = deriveTxid(txA)
    const txB = buildRawTx([], [{ programHex: REGTEST_PROGRAM_B, valueSat: 2000 }])
    const txidB = deriveTxid(txB)
    const transactions: WalletTxInfo[] = [
      makeTx(txA, txidA, { balanceChangeSat: 1000 }),
      makeTx(txB, txidB, { balanceChangeSat: 2000 })
    ]
    const result = buildMovementsFeed([], {
      network: BarkNetwork.Regtest,
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
    const utxo = makeUtxo(`${txid}:0`, { amountSat: 50_000, confirmationHeight: null })
    const entries = buildOnchainTxEntries(
      [makeTx(rawTx, txid, { balanceChangeSat: 50_000 })],
      [utxo],
      {
        network: BarkNetwork.Regtest
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
    const transactions: WalletTxInfo[] = [
      makeTx(fundingTx, fundingTxid, {
        balanceChangeSat: 100_000,
        confirmation: { hash: 'block-100', height: 100 }
      }),
      makeTx(sendTx, sendTxid, {
        balanceChangeSat: -61_000,
        confirmation: { hash: 'block-200', height: 200 },
        onchainFeeSat: 1234
      })
    ]
    const changeUtxo = makeUtxo(`${sendTxid}:1`, { amountSat: 39_000, confirmationHeight: 200 })
    const entries = buildOnchainTxEntries(transactions, [changeUtxo], {
      network: BarkNetwork.Regtest,
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

  it('exposes feeSat from tx.onchainFeeSat, null when unknown', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const [withFee] = buildOnchainTxEntries([makeTx(rawTx, txid, { onchainFeeSat: 250 })], [], {
      network: BarkNetwork.Regtest
    })
    const [withoutFee] = buildOnchainTxEntries([makeTx(rawTx, txid)], [], {
      network: BarkNetwork.Regtest
    })
    expect(withFee.feeSat).toBe(250)
    expect(withoutFee.feeSat).toBeNull()
  })

  it('marks status pending when the tx is unconfirmed', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const utxo = makeUtxo(`${txid}:0`, { amountSat: 1000, confirmationHeight: null })
    const entries = buildOnchainTxEntries([makeTx(rawTx, txid, { confirmation: null })], [utxo], {
      network: BarkNetwork.Regtest
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
      { network: BarkNetwork.Regtest }
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
      network: BarkNetwork.Regtest
    })
    expect(entry.firstSeenMs).toBe(seenMs)
    expect(entry.approximateTimestampMs).toBe(seenMs)
  })

  it('falls back to now for the timestamp when no first-seen time exists', () => {
    const rawTx = buildRawTx([], [{ programHex: REGTEST_PROGRAM_A, valueSat: 1000 }])
    const txid = deriveTxid(rawTx)
    const [entry] = buildOnchainTxEntries([makeTx(rawTx, txid)], [], {
      network: BarkNetwork.Regtest
    })
    expect(entry.firstSeenMs).toBeNull()
    expect(entry.approximateTimestampMs).toBe(NOW.getTime())
  })
})
