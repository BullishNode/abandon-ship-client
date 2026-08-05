import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { wasmBackend } from '@/lib/backend/wasm/client'
import { isDeviceVaultSupported, openDeviceVault } from '@/lib/backend/wasm/device-vault'

// Silent wallet creation for WASM mode. Safe only because the mnemonic is
// persisted in the device vault BEFORE the wallet is considered created: the
// user has never seen the 12 words, so a wallet whose vault write failed would
// be unrecoverable after one reload. Hence the support probe up front and the
// decrypt-back verification after — if either fails, the caller falls back to
// the explicit create flow, which shows and confirms the mnemonic.

export type WasmAutoCreateResult =
  | { outcome: 'created'; fingerprint: string }
  | { outcome: 'unsupported' }

export async function autoCreateWasmWallet(): Promise<WasmAutoCreateResult> {
  if (!(await isDeviceVaultSupported())) {
    return { outcome: 'unsupported' }
  }
  const mnemonic = generateMnemonic(wordlist)
  const { fingerprint } = await wasmBackend.walletApi.createWallet({ mnemonic })
  if (fingerprint.length === 0) {
    throw new Error('Wallet creation returned no fingerprint')
  }
  const persisted = await openDeviceVault()
  if (persisted !== mnemonic) {
    // The just-created wallet is empty and its seed was never shown, so
    // deleting it is the only non-deadly option.
    await wasmBackend.walletApi.walletDelete({ dangerous: true, fingerprint })
    return { outcome: 'unsupported' }
  }
  return { fingerprint, outcome: 'created' }
}
