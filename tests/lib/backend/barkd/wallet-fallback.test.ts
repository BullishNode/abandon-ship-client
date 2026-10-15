import { Configuration, ResponseError } from '@secondts/barkd'
import { address } from 'bitcoinjs-lib'
import { describe, expect, it, vi } from 'vitest'
import { WalletFallbackApi } from '@/lib/backend/barkd/wallet-fallback'

const destination = address.toBech32(new Uint8Array(20).fill(1), 0, 'tb')
function client(responses: Response[]) {
  const fetchApi = vi.fn<typeof fetch>()
  responses.forEach((response) => fetchApi.mockResolvedValueOnce(response))
  return { api: new WalletFallbackApi(new Configuration({ basePath: '/api/barkd', fetchApi })), fetchApi }
}

describe(WalletFallbackApi, () => {
  it('gets the native destination and preserves its sequence', async () => {
    const { api, fetchApi } = client([Response.json({ address: destination, seq: 3 })])
    await expect(api.destination()).resolves.toStrictEqual({ address: destination, seq: 3 })
    expect(fetchApi.mock.calls[0]?.[0]).toBe('/api/barkd/api/v1/wallet/fallback-destination')
    expect(fetchApi.mock.calls[0]?.[1]?.method).toBe('GET')
  })
  it('refuses the wrong network', async () => {
    const { api } = client([Response.json({ address: address.toBech32(new Uint8Array(20).fill(1), 0, 'bc'), seq: 0 })])
    await expect(api.destination()).rejects.toThrow()
  })
  it.each([undefined, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('refuses invalid sequence %s', async (seq) => {
    const { api } = client([Response.json({ address: destination, seq })])
    await expect(api.destination()).rejects.toThrow()
  })
  it('does not translate a missing route into an empty successful response', async () => {
    const { api } = client([new Response('missing', { status: 404 })])
    await expect(api.destination()).rejects.toBeInstanceOf(ResponseError)
  })
  it('syncs onchain then the complete wallet using actual void-response routes', async () => {
    const { api, fetchApi } = client([new Response(null), new Response(null)])
    await api.sync()
    expect(fetchApi.mock.calls.map((call) => [call[0], call[1]?.method])).toStrictEqual([
      ['/api/barkd/api/v1/onchain/sync', 'POST'], ['/api/barkd/api/v1/wallet/sync', 'POST']
    ])
  })
  it('preserves a failed onchain sync and never pretends the wallet was refreshed', async () => {
    const { api, fetchApi } = client([new Response('failed', { status: 500 })])
    await expect(api.sync()).rejects.toBeInstanceOf(ResponseError)
    expect(fetchApi).toHaveBeenCalledTimes(1)
  })
})
