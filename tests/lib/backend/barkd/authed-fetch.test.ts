import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearStoredAuthToken, storeAuthToken } from '@/lib/backend/barkd/auth-token'
import { authedFetch, handleUnauthorized, withAuthToken } from '@/lib/backend/barkd/authed-fetch'
import { authMiddleware } from '@/lib/backend/barkd/client-config'
import { useAuthStore } from '@/stores/auth'

const TOKEN = 'AKoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKio'

function resetAuthStore() {
  useAuthStore.setState({
    authRequired: false,
    authed: true,
    tokenRejected: false,
    tokenRequired: false
  })
}

describe(withAuthToken, () => {
  beforeEach(() => {
    clearStoredAuthToken()
  })

  it('returns the init untouched when no token is stored', () => {
    const init = { method: 'POST' }
    expect(withAuthToken(init)).toBe(init)
  })

  it('adds the bearer and keeps existing headers', () => {
    storeAuthToken(TOKEN)
    const init = withAuthToken({ headers: { 'X-Requested-With': 'bark' } })
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`)
    expect(headers.get('x-requested-with')).toBe('bark')
  })
})

describe(handleUnauthorized, () => {
  beforeEach(() => {
    clearStoredAuthToken()
    resetAuthStore()
  })

  it('ignores non-401 responses', () => {
    storeAuthToken(TOKEN)
    handleUnauthorized(new Response('', { status: 500 }))
    expect(useAuthStore.getState().tokenRequired).toBeFalsy()
  })

  it('marks the UI-password session as expired when UI auth is on', () => {
    useAuthStore.setState({ authRequired: true, authed: true })
    handleUnauthorized(new Response('', { status: 401 }))
    expect(useAuthStore.getState()).toMatchObject({
      authRequired: true,
      authed: false,
      tokenRequired: false
    })
  })

  it('drops the bearer and asks for a token when barkd itself rejected us', () => {
    storeAuthToken(TOKEN)
    handleUnauthorized(new Response('', { status: 401 }))
    expect(useAuthStore.getState()).toMatchObject({ tokenRejected: true, tokenRequired: true })
    expect(withAuthToken({})).toStrictEqual({})
  })
})

describe(authedFetch, () => {
  beforeEach(() => {
    clearStoredAuthToken()
    resetAuthStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the stored bearer with same-origin credentials', async () => {
    storeAuthToken(TOKEN)
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await authedFetch('/api/config')

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/config')
    expect(init?.credentials).toBe('same-origin')
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
  })

  it('routes a 401 to the token prompt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))

    const response = await authedFetch('/api/config')

    expect(response.status).toBe(401)
    expect(useAuthStore.getState()).toMatchObject({ tokenRejected: false, tokenRequired: true })
  })
})

describe('client-config authMiddleware', () => {
  beforeEach(() => {
    clearStoredAuthToken()
    resetAuthStore()
  })

  it('injects the bearer per request so a token entered later is picked up', async () => {
    const context = { fetch, init: { headers: {} }, url: '/api/barkd/api/v1/wallet' }
    const before = await authMiddleware.pre?.(context)
    expect(new Headers(before?.init.headers).get('authorization')).toBeNull()

    storeAuthToken(TOKEN)
    const after = await authMiddleware.pre?.(context)
    expect(new Headers(after?.init.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
  })

  it('reacts to a 401 from the generated client', async () => {
    storeAuthToken(TOKEN)
    const response = new Response('', { status: 401 })
    await authMiddleware.post?.({ fetch, init: {}, response, url: '/api/barkd/api/v1/wallet' })
    expect(useAuthStore.getState()).toMatchObject({ tokenRejected: true, tokenRequired: true })
  })
})
