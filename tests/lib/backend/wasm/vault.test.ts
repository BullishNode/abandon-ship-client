import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearVault,
  hasVault,
  InvalidPasswordError,
  openVault,
  saveVault
} from '@/lib/backend/wasm/vault'

const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
const PASSWORD = 'correct horse battery staple'

describe('wasm vault', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips the mnemonic through save/open', async () => {
    await saveVault(MNEMONIC, PASSWORD)
    await expect(openVault(PASSWORD)).resolves.toBe(MNEMONIC)
  })

  it('rejects a wrong password with InvalidPasswordError', async () => {
    await saveVault(MNEMONIC, PASSWORD)
    await expect(openVault('wrong password')).rejects.toBeInstanceOf(InvalidPasswordError)
  })

  it('rejects open when no vault is stored', async () => {
    await expect(openVault(PASSWORD)).rejects.toBeInstanceOf(InvalidPasswordError)
  })

  it('reports presence via hasVault', async () => {
    expect(hasVault()).toBeFalsy()
    await saveVault(MNEMONIC, PASSWORD)
    expect(hasVault()).toBeTruthy()
    clearVault()
    expect(hasVault()).toBeFalsy()
  })

  it('treats corrupt stored JSON as no vault', () => {
    localStorage.setItem('bark-web-wasm-vault-signet', 'not json {')
    expect(hasVault()).toBeFalsy()
  })

  it('treats a wrong-shaped stored object as no vault', () => {
    localStorage.setItem('bark-web-wasm-vault-signet', JSON.stringify({ foo: 'bar', v: 1 }))
    expect(hasVault()).toBeFalsy()
  })

  it('does not persist the mnemonic in cleartext', async () => {
    await saveVault(MNEMONIC, PASSWORD)
    const raw = localStorage.getItem('bark-web-wasm-vault-signet') ?? ''
    expect(raw).not.toContain('legal')
    expect(raw).not.toContain('sausage')
  })
})
