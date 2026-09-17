// Bearer token for an embedded barkd (the daemon serving this SPA itself).
// barkd must never hand the token out over an unauthenticated route (`GET /`
// is reachable by any local process), so the user brings it out-of-band: the
// link barkd prints at startup carries it in the URL fragment, or they paste
// it. Proxied deployments inject the bearer server-side and never store one.

import { useAuthStore } from '@/stores/auth'
import type { ConnectAuthTokenResult } from '@/types/auth'

const STORAGE_KEY = 'bark-web:barkd-auth-token'
const URL_PARAM = 'auth_token'
const UNAUTHORIZED = 401

// base64url, as bark-rest's `AuthToken::encode` emits. Length not pinned so a
// future token version keeps passing.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/u

// Config loading throws this on 401: nothing can boot until the user supplies
// a token, so it must not be retried like a transient failure.
export class AuthTokenRequiredError extends Error {
  constructor() {
    super('barkd requires an auth token')
    this.name = 'AuthTokenRequiredError'
  }
}

export function isValidAuthTokenFormat(token: string): boolean {
  return token.length > 0 && TOKEN_PATTERN.test(token)
}

// Fallback when localStorage is unavailable (private mode, blocked site data).
let memoryToken: string | null = null

export function getStoredAuthToken(): string | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value !== null && value.length > 0 ? value : null
  } catch {
    return null
  }
}

export function storeAuthToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token)
  } catch {
    memoryToken = token
  }
}

export function clearStoredAuthToken(): void {
  memoryToken = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable, nothing persisted
  }
}

export function currentAuthToken(): string | null {
  return getStoredAuthToken() ?? memoryToken
}

// Both locations are always scrubbed; the fragment value wins when both carry one.
function takeTokenFromUrl(url: URL): string | null {
  const fragment = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  const hashParams = new URLSearchParams(fragment)
  const fromHash = hashParams.get(URL_PARAM)
  if (fromHash !== null) {
    hashParams.delete(URL_PARAM)
    const rest = hashParams.toString()
    url.hash = rest.length > 0 ? `#${rest}` : ''
  }
  const fromQuery = url.searchParams.get(URL_PARAM)
  if (fromQuery !== null) {
    url.searchParams.delete(URL_PARAM)
  }
  return fromHash ?? fromQuery
}

// The URL is scrubbed even when the token is malformed, so it never lingers in
// history or bookmarks.
export function captureAuthTokenFromUrl(): boolean {
  const url = new URL(window.location.href)
  const token = takeTokenFromUrl(url)?.trim() ?? null
  if (token === null) {
    return false
  }
  const valid = isValidAuthTokenFormat(token)
  if (valid) {
    storeAuthToken(token)
  }
  window.history.replaceState(window.history.state, '', url)
  return valid
}

// Idempotent: concurrent 401s must not turn a "rejected" prompt back into a
// "missing" one once the first call has already cleared the token.
export function rejectStoredAuthToken(): void {
  const { requireToken, tokenRequired } = useAuthStore.getState()
  if (tokenRequired) {
    return
  }
  const hadToken = currentAuthToken() !== null
  clearStoredAuthToken()
  requireToken(hadToken)
}

// Bearer-guarded and needs no wallet to exist. A 404 still counts as accepted
// (the guard ran); anything else non-2xx (5xx, proxy errors) proves nothing.
const VERIFY_PATH = '/api/barkd/api/v1/wallet'
const NOT_FOUND = 404

export async function connectAuthToken(rawToken: string): Promise<ConnectAuthTokenResult> {
  const token = rawToken.trim()
  let response: Response
  try {
    response = await fetch(VERIFY_PATH, {
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'bark' }
    })
  } catch {
    return { ok: false, reason: 'error' }
  }
  if (response.status === UNAUTHORIZED) {
    return { ok: false, reason: 'invalid' }
  }
  if (!(response.ok || response.status === NOT_FOUND)) {
    return { ok: false, reason: 'error' }
  }
  storeAuthToken(token)
  return { ok: true }
}
