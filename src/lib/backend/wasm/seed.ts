// In-memory holder for the wallet seed in WASM mode.
//
// This module keeps the mnemonic in memory for the session only and never
// writes it to disk. Persistence-at-rest is a separate, opt-in concern handled
// by the encrypted vault (vault.ts): if the user sets a password, the mnemonic
// is stored encrypted so a reload can unlock with the password; otherwise a
// reload drops the seed and the auth gate re-collects the phrase. The bindings
// have no mnemonic read-back API, so this holder is also what
// `walletApi.mnemonic()` returns.

let sessionMnemonic: string | null = null

export function setSessionMnemonic(mnemonic: string): void {
  sessionMnemonic = mnemonic
}

export function getSessionMnemonic(): string | null {
  return sessionMnemonic
}

export function hasSessionMnemonic(): boolean {
  return sessionMnemonic !== null
}

export function clearSessionMnemonic(): void {
  sessionMnemonic = null
}
