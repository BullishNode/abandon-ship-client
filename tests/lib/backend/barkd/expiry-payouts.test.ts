import { Configuration, ResponseError } from '@secondts/barkd'
import { address as addressLib } from 'bitcoinjs-lib'
import { describe, expect, it, vi } from 'vitest'
import { ExpiryPayoutsApi } from '@/lib/backend/barkd/expiry-payouts'

function apiReturning(response: Response) {
  const fetchApi = vi.fn<typeof fetch>().mockResolvedValue(response)
  const api = new ExpiryPayoutsApi(new Configuration({ basePath: '/api/barkd', fetchApi }))
  return { api, fetchApi }
}

function sentBody(fetchApi: ReturnType<typeof vi.fn<typeof fetch>>): unknown {
  const body = fetchApi.mock.calls[0]?.[1]?.body
  return typeof body === 'string' ? JSON.parse(body) : undefined
}

describe(ExpiryPayoutsApi, () => {
  it('posts the ids to adopt-server-status', async () => {
    const { api, fetchApi } = apiReturning(
      Response.json([
        { state: 'spent', vtxo_id: 'a:0' },
        { state: 'something-new', vtxo_id: 'b:0' }
      ])
    )
    const statuses = await api.adoptServerVtxoStatus(['a:0', 'b:0'])
    expect(fetchApi.mock.calls[0]?.[0]).toBe('/api/barkd/api/v1/wallet/vtxos/adopt-server-status')
    expect(sentBody(fetchApi)).toStrictEqual({ vtxo_ids: ['a:0', 'b:0'] })
    expect(statuses).toStrictEqual([
      { state: 'spent', vtxoId: 'a:0' },
      { state: 'something-new', vtxoId: 'b:0' }
    ])
  })

  it('offers status reconciliation without legacy payout lookup or a second sweep', () => {
    const { api } = apiReturning(Response.json([]))
    expect(api).not.toHaveProperty('findExpiryPayouts')
    expect(api).not.toHaveProperty('sweepExpiryPayouts')
  })

  it('throws a ResponseError when barkd lacks the route', async () => {
    const { api } = apiReturning(new Response('not found', { status: 404 }))
    await expect(api.adoptServerVtxoStatus([])).rejects.toBeInstanceOf(ResponseError)
  })
})


describe('immutable native payout destination', () => {
  const address = addressLib.toBech32(new Uint8Array(20).fill(7), 0, 'tb')

  it('reads the exact native GET route with the configured bearer and preserves the address', async () => {
    const fetchApi = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ address }))
    const api = new ExpiryPayoutsApi(new Configuration({
      basePath: '/api/barkd', fetchApi, headers: { Authorization: 'Bearer synthetic-test-token' }
    }))
    await expect(api.fallbackDestination('signet')).resolves.toBe(address)
    const [url, init] = fetchApi.mock.calls[0] ?? []
    expect(url).toBe('/api/barkd/api/v1/wallet/fallback-destination')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-test-token')
  })

  it.each([
    {}, { address: null }, { address: '' }, { address: 'invalid' },
    { address: ` ${address}` }, { address, replacement: address }
  ])('refuses malformed native destination %j', async (body) => {
    const { api } = apiReturning(Response.json(body))
    await expect(api.fallbackDestination('signet')).rejects.toThrow()
  })

  it('refuses a valid address for another wallet network', async () => {
    const { api } = apiReturning(Response.json({ address }))
    await expect(api.fallbackDestination('regtest')).rejects.toThrow('wallet network')
  })

  it.each([401, 404, 500])('does not substitute an address after HTTP %s', async (status) => {
    const { api } = apiReturning(new Response('unavailable', { status }))
    await expect(api.fallbackDestination('signet')).rejects.toBeInstanceOf(ResponseError)
  })
})
