import { BarkNetwork } from '@secondts/barkd'
import { address, networks, Transaction } from 'bitcoinjs-lib'

export interface DecodedOutput {
  vout: number
  address: string | undefined
  valueSat: number
}

export interface DecodedInput {
  prevTxid: string
  prevVout: number
}

function networkFor(network: BarkNetwork): networks.Network {
  if (network === BarkNetwork.Mainnet) {
    return networks.bitcoin
  }
  if (network === BarkNetwork.Regtest) {
    return networks.regtest
  }
  return networks.testnet
}

function safeAddressFromScript(script: Uint8Array, net: networks.Network): string | undefined {
  try {
    if (script.length === 22 && script[0] === 0x00 && script[1] === 0x14) {
      return address.toBech32(script.slice(2), 0, net.bech32)
    }
    if (script.length === 34 && script[0] === 0x00 && script[1] === 0x20) {
      return address.toBech32(script.slice(2), 0, net.bech32)
    }
    if (script.length === 34 && script[0] === 0x51 && script[1] === 0x20) {
      return address.toBech32(script.slice(2), 1, net.bech32)
    }
    if (
      script.length === 25 &&
      script[0] === 0x76 &&
      script[1] === 0xa9 &&
      script[2] === 0x14 &&
      script[23] === 0x88 &&
      script[24] === 0xac
    ) {
      return address.toBase58Check(script.slice(3, 23), net.pubKeyHash)
    }
    if (script.length === 23 && script[0] === 0xa9 && script[1] === 0x14 && script[22] === 0x87) {
      return address.toBase58Check(script.slice(2, 22), net.scriptHash)
    }
  } catch {
    // ignore encoding failure
  }
  return undefined
}

function bufferToTxidHex(hashLE: Uint8Array): string {
  const reversed = new Uint8Array(hashLE.length)
  for (let i = 0; i < hashLE.length; i += 1) {
    reversed[i] = hashLE[hashLE.length - 1 - i]
  }
  return [...reversed].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function decodeOutputs(rawTxHex: string, network: BarkNetwork): DecodedOutput[] {
  try {
    const tx = Transaction.fromHex(rawTxHex)
    const net = networkFor(network)
    return tx.outs.map((out, vout) => ({
      address: safeAddressFromScript(out.script, net),
      valueSat: Number(out.value),
      vout
    }))
  } catch {
    return []
  }
}

export function decodeInputs(rawTxHex: string): DecodedInput[] {
  try {
    const tx = Transaction.fromHex(rawTxHex)
    return tx.ins.map((input) => ({
      prevTxid: bufferToTxidHex(input.hash),
      prevVout: input.index
    }))
  } catch {
    return []
  }
}
