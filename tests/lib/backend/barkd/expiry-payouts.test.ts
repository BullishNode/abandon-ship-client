import { Configuration, ResponseError } from '@secondts/barkd'
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

  it('maps expiry payouts', async () => {
    const { api, fetchApi } = apiReturning(
      Response.json([{ amount_sat: 9500, confirmations: 2, txid: 't', vout: 1, vtxo_id: 'a:0' }])
    )
    await expect(api.findExpiryPayouts()).resolves.toStrictEqual([
      { amountSats: 9500, txid: 't', vout: 1, vtxoId: 'a:0' }
    ])
    expect(sentBody(fetchApi)).toStrictEqual({})
  })

  it('posts to the sweep route and maps the result', async () => {
    const { api, fetchApi } = apiReturning(Response.json({ swept_sat: 9300, txid: 's' }))
    await expect(api.sweepExpiryPayouts()).resolves.toStrictEqual({ sweptSats: 9300, txid: 's' })
    expect(fetchApi.mock.calls[0]?.[0]).toBe('/api/barkd/api/v1/onchain/sweep-expiry-payouts')
    expect(sentBody(fetchApi)).toStrictEqual({})
  })

  it('preserves an ambiguous coin association as null', async () => {
    const { api } = apiReturning(
      Response.json([{ amount_sat: 9500, txid: 't', vout: 1, vtxo_id: null }])
    )
    await expect(api.findExpiryPayouts()).resolves.toStrictEqual([
      { amountSats: 9500, txid: 't', vout: 1, vtxoId: null }
    ])
  })

  it('throws a ResponseError when barkd lacks the route', async () => {
    const { api } = apiReturning(new Response('not found', { status: 404 }))
    await expect(api.adoptServerVtxoStatus([])).rejects.toBeInstanceOf(ResponseError)
  })
})
