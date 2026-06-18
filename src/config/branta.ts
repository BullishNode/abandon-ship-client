import { BrantaServerBaseUrl, createNobleCryptoProvider } from '@branta-ops/branta'
import { BrantaService } from '@branta-ops/branta/v2'
import { gcm } from '@noble/ciphers/aes.js'
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { randomBytes } from '@noble/hashes/utils.js'

const cryptoProvider = createNobleCryptoProvider({
  gcm,
  // branta passes its sha256 HashFn; noble v2 hmac needs the CHash, so call sha256 directly
  hmac: (_hash, key, message) => hmac(sha256, key, message),
  randomBytes,
  sha256
})

export const brantaClient = new BrantaService(
  {
    baseUrl: BrantaServerBaseUrl.Production,
    privacy: 'strict'
  },
  { crypto: cryptoProvider }
)
