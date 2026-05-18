import { BarkNetwork } from '@secondts/barkd'
import { Transaction } from 'bitcoinjs-lib'
import { describe, expect, it } from 'vitest'
import { decodeInputs, decodeOutputs } from '../../src/utils/tx-address'

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function reverseBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[bytes.length - 1 - i]
  }
  return out
}

const DUMMY_PREVOUT = '0000000000000000000000000000000000000000000000000000000000000001'
const PUBKEY_HASH_20 = '0000000000000000000000000000000000000001'
const SCRIPT_HASH_32 = '0000000000000000000000000000000000000000000000000000000000000001'
const TAPROOT_KEY_32 = '0000000000000000000000000000000000000000000000000000000000000002'

function p2wpkhScript(hashHex: string): Uint8Array {
  const program = hexToBytes(hashHex)
  return new Uint8Array([0x00, program.length, ...program])
}

function p2wshScript(hashHex: string): Uint8Array {
  const program = hexToBytes(hashHex)
  return new Uint8Array([0x00, program.length, ...program])
}

function p2trScript(xOnlyKeyHex: string): Uint8Array {
  const program = hexToBytes(xOnlyKeyHex)
  return new Uint8Array([0x51, program.length, ...program])
}

function p2pkhScript(hashHex: string): Uint8Array {
  const program = hexToBytes(hashHex)
  return new Uint8Array([0x76, 0xa9, program.length, ...program, 0x88, 0xac])
}

function p2shScript(hashHex: string): Uint8Array {
  const program = hexToBytes(hashHex)
  return new Uint8Array([0xa9, program.length, ...program, 0x87])
}

function buildTxHex(outputs: { script: Uint8Array; valueSat: number }[]): string {
  const tx = new Transaction()
  tx.version = 2
  tx.addInput(reverseBytes(hexToBytes(DUMMY_PREVOUT)), 0)
  for (const out of outputs) {
    tx.addOutput(out.script, BigInt(out.valueSat))
  }
  return tx.toHex()
}

describe(decodeOutputs, () => {
  it('decodes P2WPKH to bech32 v0', () => {
    const hex = buildTxHex([{ script: p2wpkhScript(PUBKEY_HASH_20), valueSat: 1000 }])
    const [out] = decodeOutputs(hex, BarkNetwork.Regtest)
    expect(out.address).toMatch(/^bcrt1q/u)
    expect(out.valueSat).toBe(1000)
  })

  it('decodes P2WSH to bech32 v0', () => {
    const hex = buildTxHex([{ script: p2wshScript(SCRIPT_HASH_32), valueSat: 1000 }])
    const [out] = decodeOutputs(hex, BarkNetwork.Regtest)
    expect(out.address).toMatch(/^bcrt1q/u)
  })

  it('decodes P2TR to bech32m v1', () => {
    const hex = buildTxHex([{ script: p2trScript(TAPROOT_KEY_32), valueSat: 1000 }])
    const [out] = decodeOutputs(hex, BarkNetwork.Signet)
    expect(out.address).toMatch(/^tb1p/u)
  })

  it('decodes P2PKH to base58', () => {
    const hex = buildTxHex([{ script: p2pkhScript(PUBKEY_HASH_20), valueSat: 1000 }])
    const [out] = decodeOutputs(hex, BarkNetwork.Mainnet)
    expect(out.address?.startsWith('1')).toBeTruthy()
  })

  it('decodes P2SH to base58', () => {
    const hex = buildTxHex([{ script: p2shScript(PUBKEY_HASH_20), valueSat: 1000 }])
    const [out] = decodeOutputs(hex, BarkNetwork.Mainnet)
    expect(out.address?.startsWith('3')).toBeTruthy()
  })

  it('returns undefined for non-standard scripts', () => {
    const opReturn = new Uint8Array([0x6a, 0x04, 0x01, 0x02, 0x03, 0x04])
    const hex = buildTxHex([{ script: opReturn, valueSat: 0 }])
    const [out] = decodeOutputs(hex, BarkNetwork.Regtest)
    expect(out.address).toBeUndefined()
  })

  it('uses signet prefix for Mutinynet', () => {
    const hex = buildTxHex([{ script: p2wpkhScript(PUBKEY_HASH_20), valueSat: 1000 }])
    const [out] = decodeOutputs(hex, BarkNetwork.Mutinynet)
    expect(out.address?.startsWith('tb1q')).toBeTruthy()
  })

  it('returns empty array for invalid tx hex', () => {
    expect(decodeOutputs('not-hex', BarkNetwork.Regtest)).toStrictEqual([])
  })
})

describe(decodeInputs, () => {
  it('returns prevTxid and prevVout for each input', () => {
    const tx = new Transaction()
    tx.version = 2
    tx.addInput(reverseBytes(hexToBytes(DUMMY_PREVOUT)), 3)
    tx.addOutput(p2wpkhScript(PUBKEY_HASH_20), 1000n)
    const inputs = decodeInputs(tx.toHex())
    expect(inputs).toHaveLength(1)
    expect(inputs[0].prevTxid).toBe(DUMMY_PREVOUT)
    expect(inputs[0].prevVout).toBe(3)
  })

  it('returns empty array for invalid tx hex', () => {
    expect(decodeInputs('not-hex')).toStrictEqual([])
  })
})
