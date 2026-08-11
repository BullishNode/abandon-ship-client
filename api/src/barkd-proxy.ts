// The seed is served only through the session-guarded `/api/reveal-mnemonic`
// endpoint. barkd's router treats trailing/repeated slashes and percent-encoding
// as equivalent, so normalize before matching rather than comparing the raw path.
const BLOCKED_BARKD_SUBPATH = '/api/v1/wallet/mnemonic'

export function isBlockedBarkdSubPath(subPath: string): boolean {
  let normalized: string
  try {
    normalized = decodeURIComponent(subPath)
  } catch {
    // Fail closed on malformed encoding.
    return true
  }
  normalized = normalized
    .toLowerCase()
    .replaceAll(/\/{2,}/gu, '/')
    .replace(/\/+$/u, '')
  return normalized === BLOCKED_BARKD_SUBPATH
}
