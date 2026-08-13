// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The allowlist's matching logic is unit-tested in `mnemonic-guard.test.ts`. This
// suite pins the *wiring*: that `app.all('/api/barkd/*')` applies the allowlist to
// the path barkd will receive, returns 404 without calling fetch for a disallowed
// route, and proxies allowed routes through with the correct upstream path.
//
// Note on coverage limits: `app.request()` normalizes control bytes the same way
// undici does on the real wire, so this in-process harness cannot reproduce the
// split-normalization window that the raw HTTP bypass exploited. The allowlist is
// robust regardless (anything not canonically on the list fails closed); this
// suite's job is to prove the route is wired to the allowlist at all.

// Importing the API app must be side-effect-free (no port bind). `UI_AUTH` is left
// unset so `requireSession` passes through — the exact Umbrel cross-app scenario.
const { app } = await import('../../api/src/index.ts')

const BARKD_ORIGIN = 'http://barkd:4000'

// Return type is a plain `Response` (not a promise): the mock builds it
// synchronously, and the proxy awaits the result either way. This keeps the mock
// body free of `async`/`await`, which the formatter and `require-await` disagree
// about when it is written as an inline callback.
type FetchFn = (input: string | URL, init?: RequestInit) => Response

// Fake barkd: echo back the pathname it was asked for so tests can assert the
// exact upstream path, and prove whether fetch was reached at all.
function echoUpstreamPath(input: string | URL): Response {
  const url = typeof input === 'string' ? new URL(input) : input
  return Response.json({ upstreamPath: url.pathname })
}

function request(rawPath: string): Response | Promise<Response> {
  return app.request(`http://localhost:4001${rawPath}`)
}

// Disallowed routes that the proxy route matches and the allowlist rejects with
// its own `{ error: 'not_found' }` body. The control-byte entries are the exact
// bypass variants from the follow-up mnemonic-exposure report: NUL and TAB that
// undici strips on the wire so the forwarded path collapses back to the blocked
// mnemonic route. The allowlist rejects them because neither the raw nor the
// stripped form is a listed route.
const REJECTED_VARIANTS = [
  '/api/barkd/api/v1/wallet/mnemonic',
  // report variants: NUL and TAB (two positions) that undici strips on the wire
  '/api/barkd/api/v1/wallet/mnemonic%00',
  '/api/barkd/api%09/v1/wallet/mnemonic',
  '/api/barkd/api/v1/wall%09et/mnemonic',
  '/api/barkd//api/v1/wallet/mnemonic',
  '/api/barkd/api/v1/wallet/mnemonic/',
  '/api/barkd/api/v1/wallet/mnemonic-backup',
  '/api/barkd/api/v1/wallet/does-not-exist',
  '/api/barkd/api/v2/wallet/balance'
]

// CR/LF variants: the framework rejects these before dispatch, so they get Hono's
// default 404 text instead of the allowlist body. Still safe — 404, no upstream
// call — but asserted separately since the body differs. (The report noted `%0a`/
// `%0d` already 404'd in its stack; `\t` was the sufficient bypass.)
const CRLF_REJECTED_VARIANTS = [
  '/api/barkd/api/v1/wallet/mnemonic%0a',
  '/api/barkd/api/v1/wallet/mnemonic%0d'
]

// Allowed routes that must proxy through, mapped to the upstream pathname barkd
// should receive.
const ALLOWED_VARIANTS: [string, string][] = [
  ['/api/barkd/api/v1/wallet/balance', '/api/v1/wallet/balance'],
  ['/api/barkd/api/v1/wallet/send', '/api/v1/wallet/send'],
  ['/api/barkd/api/v1/wallet/vtxos/abc123', '/api/v1/wallet/vtxos/abc123'],
  ['/api/barkd/api/v1/wallet/vtxos/abc123/encoded', '/api/v1/wallet/vtxos/abc123/encoded'],
  ['/api/barkd/api/v1/history/42/metadata', '/api/v1/history/42/metadata'],
  ['/api/barkd/ping', '/ping']
]

describe('GET /api/barkd/* allowlist', () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchFn>>

  beforeEach(() => {
    fetchMock = vi.fn<FetchFn>().mockImplementation(echoUpstreamPath)
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each(REJECTED_VARIANTS)('blocks %s with 404 and never reaches barkd', async (path) => {
    const res = await request(path)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toStrictEqual({ error: 'not_found' })
    // The critical assertion: no upstream call, so nothing hidden is fetched.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(CRLF_REJECTED_VARIANTS)('blocks %s with 404 and never reaches barkd', async (path) => {
    const res = await request(path)
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(ALLOWED_VARIANTS)('proxies %s to barkd', async (path, upstreamPath) => {
    const res = await request(path)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toStrictEqual({ upstreamPath })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [[calledWith]] = fetchMock.mock.calls
    const calledUrl = typeof calledWith === 'string' ? calledWith : calledWith.href
    expect(calledUrl).toBe(`${BARKD_ORIGIN}${upstreamPath}`)
  })

  it('forwards the query string to barkd', async () => {
    const res = await request('/api/barkd/api/v1/wallet/balance?foo=bar')
    expect(res.status).toBe(200)
    const [[calledWith]] = fetchMock.mock.calls
    const calledUrl = typeof calledWith === 'string' ? calledWith : calledWith.href
    expect(calledUrl).toBe(`${BARKD_ORIGIN}/api/v1/wallet/balance?foo=bar`)
  })
})
