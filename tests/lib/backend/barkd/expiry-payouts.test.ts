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

  it('throws a ResponseError when barkd lacks the route', async () => {
    const { api } = apiReturning(new Response('not found', { status: 404 }))
    await expect(api.adoptServerVtxoStatus([])).rejects.toBeInstanceOf(ResponseError)
  })
})
