import { AES_KEY_BITS, decryptUtf8, encryptUtf8 } from '@/lib/backend/wasm/cipher'
import { config } from '@/config/runtime'

// Device vault: persists the mnemonic encrypted under a NON-EXTRACTABLE
// AES-GCM key stored in IndexedDB, so a passwordless wallet survives reloads
// and unlocks silently. This is deliberately weaker than the password vault
// (vault.ts): any same-origin script can use the key to decrypt, so it does
// not defend against XSS or an attacker with full browser-profile access. What
// it buys over plaintext is that the raw key material can never be exported by
// JS, so copying localStorage (or the export blob) alone can not recover the
// seed. Setting a user password replaces this vault with the password vault.

const DB_NAME = 'bark-web-wasm-device-keys'
const STORE_NAME = 'keys'
const STORAGE_KEY_PREFIX = 'bark-web-wasm-device-vault'
const VAULT_VERSION = 1
const PROBE_KEY = '__probe__'

interface StoredDeviceVault {
  v: number
  iv: string
  ct: string
}

function storageKey(): string {
  return `${STORAGE_KEY_PREFIX}-${config.network}`
}

function keyRecordName(): string {
  return config.network
}

async function openKeyDb(): Promise<IDBDatabase> {
  // oxlint-disable-next-line promise/avoid-new
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.addEventListener('upgradeneeded', () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    })
    request.addEventListener('success', () => {
      resolve(request.result)
    })
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Failed to open device key store'))
    })
  })
}

async function withKeyStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openKeyDb()
  try {
    // oxlint-disable-next-line promise/avoid-new
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const request = operation(transaction.objectStore(STORE_NAME))
      request.addEventListener('success', () => {
        resolve(request.result)
      })
      request.addEventListener('error', () => {
        reject(request.error ?? new Error('Device key store request failed'))
      })
    })
  } finally {
    db.close()
  }
}

async function readDeviceKey(name: string): Promise<CryptoKey | null> {
  const value = await withKeyStore('readonly', (store) => store.get(name))
  return value instanceof CryptoKey ? value : null
}

async function generateDeviceKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey({ length: AES_KEY_BITS, name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt'
  ])
}

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const existing = await readDeviceKey(keyRecordName())
  if (existing !== null) {
    return existing
  }
  const key = await generateDeviceKey()
  await withKeyStore('readwrite', (store) => store.put(key, keyRecordName()))
  return key
}

function isStoredDeviceVault(value: unknown): value is StoredDeviceVault {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record: Record<string, unknown> = { ...value }
  return (
    typeof record.v === 'number' && typeof record.iv === 'string' && typeof record.ct === 'string'
  )
}

function readStoredDeviceVault(): StoredDeviceVault | null {
  const raw = localStorage.getItem(storageKey())
  if (raw === null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return isStoredDeviceVault(parsed) ? parsed : null
  } catch {
    return null
  }
}

// Probe that a non-extractable CryptoKey survives an IndexedDB round-trip in
// this browser. Some private-browsing modes accept the write but drop or
// reject the structured clone; auto-create must know BEFORE minting a wallet
// whose seed the user has never seen, so a failed probe routes to the explicit
// create flow instead.
export async function isDeviceVaultSupported(): Promise<boolean> {
  try {
    const key = await generateDeviceKey()
    await withKeyStore('readwrite', (store) => store.put(key, PROBE_KEY))
    const roundTripped = await readDeviceKey(PROBE_KEY)
    await withKeyStore('readwrite', (store) => store.delete(PROBE_KEY))
    return roundTripped !== null
  } catch {
    return false
  }
}

export function hasDeviceVault(): boolean {
  return readStoredDeviceVault() !== null
}

export async function saveDeviceVault(mnemonic: string): Promise<void> {
  const key = await getOrCreateDeviceKey()
  const { ct, iv } = await encryptUtf8(key, mnemonic)
  const stored: StoredDeviceVault = { ct, iv, v: VAULT_VERSION }
  localStorage.setItem(storageKey(), JSON.stringify(stored))
}

// Silent-unlock read: missing vault, missing key, and undecryptable ciphertext
// all return null so the caller falls back to an interactive gate.
export async function openDeviceVault(): Promise<string | null> {
  const stored = readStoredDeviceVault()
  if (stored === null) {
    return null
  }
  try {
    const key = await readDeviceKey(keyRecordName())
    if (key === null) {
      return null
    }
    return await decryptUtf8(key, stored)
  } catch {
    return null
  }
}

export async function clearDeviceVault(): Promise<void> {
  // The ciphertext removal is what disables auto-unlock, so it happens first
  // and unconditionally; losing the IDB key delete (e.g. a blocked
  // transaction) must not leave a decryptable vault behind.
  localStorage.removeItem(storageKey())
  try {
    await withKeyStore('readwrite', (store) => store.delete(keyRecordName()))
  } catch {
    // Without the ciphertext the orphaned key decrypts nothing.
  }
}
