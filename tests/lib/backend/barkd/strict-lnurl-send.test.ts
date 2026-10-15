import { Configuration, ResponseError } from '@secondts/barkd'
import { describe, expect, it, vi } from 'vitest'
import { StrictLnurlSendApi } from '@/lib/backend/barkd/strict-lnurl-send'

function client(response: Response) {
  const fetchApi = vi.fn<typeof fetch>().mockResolvedValueOnce(response)
  return { api: new StrictLnurlSendApi(new Configuration({ basePath: '/api/barkd', fetchApi })), fetchApi }
}

describe(StrictLnurlSendApi, () => {
  it.each(['alice@example.test', 'LNURL1OPAQUE'])('passes strict payer policy through the actual serialized body for %s', async (destination) => {
    const { api, fetchApi } = client(Response.json({ message: 'accepted' }))
    await expect(api.send({ destination, amountSats: 1000, comment: 'memo' })).resolves.toStrictEqual({ message: 'accepted' })
    expect(fetchApi).toHaveBeenCalledTimes(1)
    const [url, init] = fetchApi.mock.calls[0]!
    expect(url).toBe('/api/barkd/api/v1/wallet/send')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toStrictEqual({ destination, amount_sat: 1000, comment: 'memo', require_lnurl_metadata: true })
  })
  it('preserves native strict refusal without generic fallback or a second request', async () => {
    const { api, fetchApi } = client(Response.json({ error: 'metadata mismatch' }, { status: 400 }))
    await expect(api.send({ destination: 'alice@example.test', amountSats: 1000 })).rejects.toBeInstanceOf(ResponseError)
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })
  it('refuses a malformed success body', async () => {
    const { api } = client(Response.json({}))
    await expect(api.send({ destination: 'alice@example.test', amountSats: 1000 })).rejects.toThrow()
  })
})
