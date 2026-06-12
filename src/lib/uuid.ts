const UUID_BYTE_LENGTH = 16
const UUID_VERSION_BYTE = 6
const UUID_VARIANT_BYTE = 8
const NIBBLE_SIZE = 16
const VERSION_4_PREFIX = 0x40
const VARIANT_FIELD_SIZE = 64
const VARIANT_RFC4122_PREFIX = 0x80

export function generateUuid(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // crypto.randomUUID is unavailable in insecure contexts (plain HTTP over LAN,
  // e.g. Umbrel), so fall back to a UUID v4 built from getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTE_LENGTH))
  bytes[UUID_VERSION_BYTE] = (bytes[UUID_VERSION_BYTE] % NIBBLE_SIZE) + VERSION_4_PREFIX
  bytes[UUID_VARIANT_BYTE] =
    (bytes[UUID_VARIANT_BYTE] % VARIANT_FIELD_SIZE) + VARIANT_RFC4122_PREFIX
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
