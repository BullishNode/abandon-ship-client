import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDeviceVault,
  hasDeviceVault,
  isDeviceVaultSupported,
  openDeviceVault,
  saveDeviceVault
} from '@/lib/backend/wasm/device-vault'

const MNEMONIC = 'legal winner thank year wave sausage worth useful legal winner thank yellow'
const VAULT_KEY = 'bark-web-wasm-device-vault-signet'

async function resetKeyDb(): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('bark-web-wasm-device-keys')
    request.addEventListener('success', () => {
      resolve()
    })
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('deleteDatabase failed'))
    })
  })
}

describe('wasm device vault', () => {
  beforeEach(async () => {
    localStorage.clear()
    await resetKeyDb()
  })

  it('reports support when IndexedDB round-trips a CryptoKey', async () => {
    await expect(isDeviceVaultSupported()).resolves.toBeTruthy()
  })

  it('round-trips the mnemonic through save/open without user input', async () => {
    await saveDeviceVault(MNEMONIC)
    await expect(openDeviceVault()).resolves.toBe(MNEMONIC)
  })

  it('returns null when no vault is stored', async () => {
    await expect(openDeviceVault()).resolves.toBeNull()
  })

  it('returns null when the ciphertext exists but the key is gone', async () => {
    await saveDeviceVault(MNEMONIC)
    await resetKeyDb()
    await expect(openDeviceVault()).resolves.toBeNull()
  })

  it('returns null for tampered ciphertext', async () => {
    await saveDeviceVault(MNEMONIC)
    const raw = localStorage.getItem(VAULT_KEY)
    expect(raw).not.toBeNull()
    const stored: { v: number; iv: string; ct: string } = JSON.parse(raw ?? '{}')
    stored.ct = btoa('tampered-ciphertext-bytes')
    localStorage.setItem(VAULT_KEY, JSON.stringify(stored))
    await expect(openDeviceVault()).resolves.toBeNull()
  })

  it('reports presence via hasDeviceVault', async () => {
    expect(hasDeviceVault()).toBeFalsy()
    await saveDeviceVault(MNEMONIC)
    expect(hasDeviceVault()).toBeTruthy()
    await clearDeviceVault()
    expect(hasDeviceVault()).toBeFalsy()
  })

  it('clear then save generates a fresh key and still round-trips', async () => {
    await saveDeviceVault(MNEMONIC)
    await clearDeviceVault()
    await expect(openDeviceVault()).resolves.toBeNull()
    await saveDeviceVault(MNEMONIC)
    await expect(openDeviceVault()).resolves.toBe(MNEMONIC)
  })

  it('treats corrupt stored JSON as no vault', () => {
    localStorage.setItem(VAULT_KEY, 'not json {')
    expect(hasDeviceVault()).toBeFalsy()
  })

  it('treats a wrong-shaped stored object as no vault', () => {
    localStorage.setItem(VAULT_KEY, JSON.stringify({ foo: 'bar', v: 1 }))
    expect(hasDeviceVault()).toBeFalsy()
  })

  it('does not persist the mnemonic in cleartext', async () => {
    await saveDeviceVault(MNEMONIC)
    const raw = localStorage.getItem(VAULT_KEY) ?? ''
    expect(raw).not.toContain('legal')
    expect(raw).not.toContain('sausage')
  })
})
