import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAuthStatus, setupPassword } from '@/lib/auth-api'

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn<() => Promise<Response>>()
  if (response instanceof Error) {
    fetchMock.mockRejectedValue(response)
  } else {
    fetchMock.mockResolvedValue(response)
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe(fetchAuthStatus, () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps configured to passwordConfigured', async () => {
    stubFetch(jsonResponse({ authRequired: true, authed: false, configured: false }))

    await expect(fetchAuthStatus()).resolves.toStrictEqual({
      authRequired: true,
      authed: false,
      passwordConfigured: false
    })
  })

  it('treats an absent configured flag as configured', async () => {
    stubFetch(jsonResponse({ authRequired: true, authed: false }))

    await expect(fetchAuthStatus()).resolves.toStrictEqual({
      authRequired: true,
      authed: false,
      passwordConfigured: true
    })
  })

  it.each([
    ['a failed response', jsonResponse({ error: 'boom' }, 500)],
    ['an unparseable body', jsonResponse({ authRequired: 'yes' })],
    ['a network error', new Error('offline')]
  ])('falls back to an open status on %s', async (_label, response) => {
    stubFetch(response)

    await expect(fetchAuthStatus()).resolves.toStrictEqual({ authRequired: false, authed: true })
  })
})

describe(setupPassword, () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the password with the CSRF header', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }))

    await expect(setupPassword('longenough')).resolves.toStrictEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/setup', {
      body: JSON.stringify({ password: 'longenough' }),
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'bark' },
      method: 'POST'
    })
  })

  it.each([
    [400, 'weak'],
    [409, 'already_configured'],
    [429, 'rate_limited'],
    [404, 'error'],
    [500, 'error']
  ])('maps %i to %s', async (status, reason) => {
    stubFetch(jsonResponse({ error: 'nope' }, status))

    await expect(setupPassword('longenough')).resolves.toStrictEqual({ ok: false, reason })
  })

  it('reports an error when the request never lands', async () => {
    stubFetch(new Error('offline'))

    await expect(setupPassword('longenough')).resolves.toStrictEqual({ ok: false, reason: 'error' })
  })
})
