import {
  AES_KEY_BITS,
  decryptUtf8,
  encodeUtf8,
  encryptUtf8,
  fromBase64,
  randomBytes,
  toBase64
} from '@/lib/backend/wasm/cipher'
import { config } from '@/config/runtime'

// Encrypted-at-rest mnemonic vault for WASM mode. A user-chosen password
// derives an AES-GCM key (PBKDF2-SHA256) that encrypts the wallet mnemonic in
// localStorage, so a reload can unlock with the password instead of the full
// 12-word phrase. This protects the seed AT REST only: during a session the
// seed still lives in plaintext memory (see seed.ts), so XSS remains fatal, and
// the ciphertext is offline-brute-forceable — password strength matters.

const STORAGE_KEY_PREFIX = 'bark-web-wasm-vault'
const VAULT_VERSION = 1
const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16

interface StoredVault {
  v: number
  iter: number
  salt: string
  iv: string
  ct: string
}

// Thrown when decryption fails, which for AES-GCM means either a wrong password
// or tampered ciphertext — indistinguishable, and both surface as "invalid
// password" to the user.
export class InvalidPasswordError extends Error {
  constructor() {
    super('Invalid password')
    this.name = 'InvalidPasswordError'
  }
}

function storageKey(): string {
  return `${STORAGE_KEY_PREFIX}-${config.network}`
}

function isStoredVault(value: unknown): value is StoredVault {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record: Record<string, unknown> = { ...value }
  return (
    typeof record.v === 'number' &&
    typeof record.iter === 'number' &&
    typeof record.salt === 'string' &&
    typeof record.iv === 'string' &&
    typeof record.ct === 'string'
  )
}

function readStoredVault(): StoredVault | null {
  const raw = localStorage.getItem(storageKey())
  if (raw === null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return isStoredVault(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encodeUtf8(password), 'PBKDF2', false, [
    'deriveKey'
  ])
  return await crypto.subtle.deriveKey(
    { hash: 'SHA-256', iterations, name: 'PBKDF2', salt },
    material,
    { length: AES_KEY_BITS, name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

export function hasVault(): boolean {
  return readStoredVault() !== null
}

export async function saveVault(mnemonic: string, password: string): Promise<void> {
  if (password.length === 0) {
    throw new Error('Password must not be empty')
  }
  const salt = randomBytes(SALT_BYTES)
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const { ct, iv } = await encryptUtf8(key, mnemonic)
  const stored: StoredVault = {
    ct,
    iter: PBKDF2_ITERATIONS,
    iv,
    salt: toBase64(salt),
    v: VAULT_VERSION
  }
  localStorage.setItem(storageKey(), JSON.stringify(stored))
}

export async function openVault(password: string): Promise<string> {
  const stored = readStoredVault()
  if (stored === null) {
    throw new InvalidPasswordError()
  }
  const key = await deriveKey(password, fromBase64(stored.salt), stored.iter)
  try {
    return await decryptUtf8(key, stored)
  } catch {
    throw new InvalidPasswordError()
  }
}

export function clearVault(): void {
  localStorage.removeItem(storageKey())
}
