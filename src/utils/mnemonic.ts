import { validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

export const MNEMONIC_WORD_COUNT = 12

export function createEmptyMnemonicWords(): string[] {
  return Array.from({ length: MNEMONIC_WORD_COUNT }, () => '')
}

export function isValidMnemonic(mnemonic: string): boolean {
  const words = mnemonic.split(' ')
  return words.length === MNEMONIC_WORD_COUNT && validateMnemonic(mnemonic, wordlist)
}
