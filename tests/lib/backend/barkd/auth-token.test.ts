import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureAuthTokenFromUrl,
  clearStoredAuthToken,
  connectAuthToken,
  currentAuthToken,
  getStoredAuthToken,
  isValidAuthTokenFormat,
  rejectStoredAuthToken,
  storeAuthToken
} from '@/lib/backend/barkd/auth-token'
import { useAuthStore } from '@/stores/auth'

// 33 bytes base64url-encoded without padding, as bark-rest emits it.
const TOKEN = 'AKoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKio'

function setLocation(url: string) {
  window.history.replaceState(null, '', url)
}

describe('auth token storage', () => {
  beforeEach(() => {
    clearStoredAuthToken()
    useAuthStore.setState({ tokenRejected: false, tokenRequired: false })
  })

  it('round-trips through localStorage', () => {
    storeAuthToken(TOKEN)
    expect(getStoredAuthToken()).toBe(TOKEN)
    expect(currentAuthToken()).toBe(TOKEN)
    clearStoredAuthToken()
    expect(getStoredAuthToken()).toBeNull()
  })

  it('accepts base64url and rejects anything else', () => {
    expect(isValidAuthTokenFormat(TOKEN)).toBeTruthy()
    expect(isValidAuthTokenFormat('')).toBeFalsy()
    expect(isValidAuthTokenFormat('has space')).toBeFalsy()
    expect(isValidAuthTokenFormat('padded==')).toBeFalsy()
    expect(isValidAuthTokenFormat('plus+slash/')).toBeFalsy()
  })

  it('drops the token and routes to the prompt when barkd rejects it', () => {
    storeAuthToken(TOKEN)
    rejectStoredAuthToken()
    expect(getStoredAuthToken()).toBeNull()
    expect(useAuthStore.getState()).toMatchObject({ tokenRejected: true, tokenRequired: true })
  })

  it('reports no rejection when there was nothing stored', () => {
    rejectStoredAuthToken()
    expect(useAuthStore.getState()).toMatchObject({ tokenRejected: false, tokenRequired: true })
  })

  it('keeps the rejection flag when concurrent 401s arrive after the token was cleared', () => {
    storeAuthToken(TOKEN)
    rejectStoredAuthToken()
    rejectStoredAuthToken()
    expect(useAuthStore.getState()).toMatchObject({ tokenRejected: true, tokenRequired: true })
  })
})

describe(captureAuthTokenFromUrl, () => {
  beforeEach(() => {
    clearStoredAuthToken()
  })

  afterEach(() => {
    setLocation('/')
  })

  it('takes the token from the fragment, trimmed, and scrubs it from the URL', () => {
    setLocation(`/wallet?tab=vtxos#auth_token=%20${TOKEN}%20`)
    expect(captureAuthTokenFromUrl()).toBeTruthy()
    expect(getStoredAuthToken()).toBe(TOKEN)
    expect(window.location.pathname).toBe('/wallet')
    expect(window.location.search).toBe('?tab=vtxos')
    expect(window.location.hash).toBe('')
  })

  it('keeps other fragment params when removing the token', () => {
    setLocation(`/#auth_token=${TOKEN}&other=1`)
    expect(captureAuthTokenFromUrl()).toBeTruthy()
    expect(window.location.hash).toBe('#other=1')
  })

  it('falls back to the query string and scrubs it', () => {
    setLocation(`/?auth_token=${TOKEN}&tab=vtxos`)
    expect(captureAuthTokenFromUrl()).toBeTruthy()
    expect(getStoredAuthToken()).toBe(TOKEN)
    expect(window.location.search).toBe('?tab=vtxos')
  })

  it('prefers the fragment token and scrubs a query token too', () => {
    setLocation(`/?auth_token=QUERYTOKEN&tab=vtxos#auth_token=${TOKEN}`)
    expect(captureAuthTokenFromUrl()).toBeTruthy()
    expect(getStoredAuthToken()).toBe(TOKEN)
    expect(window.location.search).toBe('?tab=vtxos')
    expect(window.location.hash).toBe('')
  })

  it('does nothing when the URL carries no token', () => {
    setLocation('/wallet#section')
    expect(captureAuthTokenFromUrl()).toBeFalsy()
    expect(getStoredAuthToken()).toBeNull()
    expect(window.location.hash).toBe('#section')
  })

  it('scrubs but does not store a malformed token', () => {
    setLocation('/#auth_token=not%20a%20token')
    expect(captureAuthTokenFromUrl()).toBeFalsy()
    expect(getStoredAuthToken()).toBeNull()
    expect(window.location.hash).toBe('')
  })
})

describe(connectAuthToken, () => {
  beforeEach(() => {
    clearStoredAuthToken()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stores the token once barkd accepts the bearer', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(connectAuthToken(` ${TOKEN} `)).resolves.toStrictEqual({ ok: true })
    expect(getStoredAuthToken()).toBe(TOKEN)
    const init = fetchMock.mock.calls[0]?.[1]
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
  })

  it('treats a 404 as accepted (the guard runs before the handler)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no wallet', { status: 404 })))

    await expect(connectAuthToken(TOKEN)).resolves.toStrictEqual({ ok: true })
    expect(getStoredAuthToken()).toBe(TOKEN)
  })

  it.each([500, 502, 503])('does not store a token on a %i response', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })))

    await expect(connectAuthToken(TOKEN)).resolves.toStrictEqual({ ok: false, reason: 'error' })
    expect(getStoredAuthToken()).toBeNull()
  })

  it('does not store a token barkd rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))

    await expect(connectAuthToken(TOKEN)).resolves.toStrictEqual({ ok: false, reason: 'invalid' })
    expect(getStoredAuthToken()).toBeNull()
  })

  it('reports a network failure without storing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))

    await expect(connectAuthToken(TOKEN)).resolves.toStrictEqual({ ok: false, reason: 'error' })
    expect(getStoredAuthToken()).toBeNull()
  })
})
