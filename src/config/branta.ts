import { createNobleCryptoProvider } from '@branta-ops/branta'
import type { BrantaClientOptions, PrivacyMode } from '@branta-ops/branta'
import { BrantaService } from '@branta-ops/branta/v2'
import { gcm } from '@noble/ciphers/aes.js'
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { randomBytes } from '@noble/hashes/utils.js'
import { BRANTA_SERVER } from '@/config/branta-server'

const cryptoProvider = createNobleCryptoProvider({
  gcm,
  // branta passes its sha256 HashFn; noble v2 hmac needs the CHash, so call sha256 directly
  hmac: (_hash, key, message) => hmac(sha256, key, message),
  randomBytes,
  sha256
})

export const brantaClient = new BrantaService(
  {
    baseUrl: BRANTA_SERVER,
    privacy: 'strict'
  },
  { crypto: cryptoProvider }
)

/** Per-call options that override the client's default privacy mode. */
export function getBrantaClientOptions(privacy: PrivacyMode): BrantaClientOptions {
  return { baseUrl: BRANTA_SERVER, privacy }
}
