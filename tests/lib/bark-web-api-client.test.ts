import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getWalletMnemonic } from '../../src/lib/bark-web-api-client'

interface FetchInit {
  credentials?: RequestCredentials
}
type FetchFn = (url: string, init: FetchInit) => Promise<Response>

function makeResponse(init: { body?: string; ok: boolean; status?: number }): Response {
  const status = init.status ?? (init.ok ? 200 : 500)
  return new Response(init.body ?? '', { headers: new Headers(), status })
}

describe(getWalletMnemonic, () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchFn>>

  beforeEach(() => {
    fetchMock = vi.fn<FetchFn>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls /api/mnemonic with same-origin credentials', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        body: JSON.stringify({ mnemonic: 'abandon abandon abandon' }),
        ok: true
      })
    )
    await getWalletMnemonic()
    expect(fetchMock).toHaveBeenCalledOnce()
    const [firstCall] = fetchMock.mock.calls
    const [url, options] = firstCall
    expect(url).toBe('/api/mnemonic')
    expect(options).toMatchObject({ credentials: 'same-origin' })
  })

  it('returns the mnemonic string from the response payload', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        body: JSON.stringify({ mnemonic: 'word1 word2 word3' }),
        ok: true
      })
    )
    const result = await getWalletMnemonic()
    expect(result).toBe('word1 word2 word3')
  })

  it('throws with the response body when !ok and body is non-empty', async () => {
    fetchMock.mockResolvedValue(makeResponse({ body: 'boom', ok: false, status: 500 }))
    await expect(getWalletMnemonic()).rejects.toThrow('boom')
  })

  it('throws with a generic message when !ok and body is empty', async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 404 }))
    await expect(getWalletMnemonic()).rejects.toThrow('Request failed: 404')
  })
})
