// Shared AES-GCM primitives for the WASM-mode mnemonic vaults. Two vaults use
// these: the password vault (vault.ts, key derived from a user password) and
// the device vault (device-vault.ts, non-extractable key stored in IndexedDB).

export const AES_KEY_BITS = 256
const IV_BYTES = 12

// WebCrypto's BufferSource requires an ArrayBuffer-backed view (not the
// ArrayBufferLike default that `new Uint8Array(n)` and TextEncoder produce), so
// every byte buffer here is allocated over an explicit ArrayBuffer.
export function allocBytes(length: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(length))
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(allocBytes(length))
}

export function encodeUtf8(text: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text)
  const buffer = allocBytes(encoded.length)
  buffer.set(encoded)
  return buffer
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte)
  }
  return btoa(binary)
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = allocBytes(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0
  }
  return bytes
}

export interface AesGcmCiphertext {
  iv: string
  ct: string
}

export async function encryptUtf8(key: CryptoKey, plaintext: string): Promise<AesGcmCiphertext> {
  const iv = randomBytes(IV_BYTES)
  const ciphertext = await crypto.subtle.encrypt(
    { iv, name: 'AES-GCM' },
    key,
    encodeUtf8(plaintext)
  )
  return { ct: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) }
}

export async function decryptUtf8(key: CryptoKey, payload: AesGcmCiphertext): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { iv: fromBase64(payload.iv), name: 'AES-GCM' },
    key,
    fromBase64(payload.ct)
  )
  return new TextDecoder().decode(plaintext)
}
