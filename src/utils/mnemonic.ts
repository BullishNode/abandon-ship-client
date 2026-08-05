import { validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

export const MNEMONIC_WORD_COUNT = 12

export function normalizeMnemonic(input: string): string {
  return input.trim().toLowerCase().split(/\s+/u).filter(Boolean).join(' ')
}

export function isValidMnemonic(mnemonic: string): boolean {
  const words = mnemonic.split(' ')
  return words.length === MNEMONIC_WORD_COUNT && validateMnemonic(mnemonic, wordlist)
}
