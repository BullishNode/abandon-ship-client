import { authedFetch } from '@/lib/backend/barkd/authed-fetch'

// `X-Requested-With` satisfies the CSRF check when UI auth is enabled;
// same-origin credentials carry the session cookie.
const REVEAL_MNEMONIC_PATH = '/api/reveal-mnemonic'

interface RevealMnemonicResponse {
  mnemonic?: unknown
}

export async function revealMnemonic(): Promise<string> {
  const response = await authedFetch(REVEAL_MNEMONIC_PATH, {
    headers: { 'X-Requested-With': 'bark' },
    method: 'POST'
  })
  if (!response.ok) {
    throw new Error('Failed to reveal wallet mnemonic')
  }
  const body: RevealMnemonicResponse = await response.json()
  if (typeof body.mnemonic !== 'string') {
    throw new TypeError('Malformed mnemonic response')
  }
  return body.mnemonic
}
