import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fallbackRegistration } from '@/lib/backend/barkd/fallback'

const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>())
vi.mock(import('@/lib/backend/barkd/authed-fetch'), () => ({ authedFetch: fetchMock }))

describe('fallback registration', () => {
  beforeEach(() => fetchMock.mockReset())
  it('reads only the registered immutable address returned by native barkd', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ payout_address: 'tb1qapplicationaddress', registered: true })
    )
    await expect(fallbackRegistration()).resolves.toStrictEqual({
      payout_address: 'tb1qapplicationaddress',
      registered: true
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/barkd/api/v1/wallet/fallback', expect.any(Object))
  })

  it('distinguishes an unregistered wallet from an unreachable or incompatible backend', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ payout_address: null, registered: false }))
    const unregistered = await fallbackRegistration()
    expect(unregistered.registered).toBeFalsy()
    fetchMock.mockResolvedValueOnce(new Response('offline', { status: 503 }))
    await expect(fallbackRegistration()).rejects.toThrow('unavailable')
    fetchMock.mockResolvedValueOnce(Response.json({ payout_address: null, registered: true }))
    await expect(fallbackRegistration()).rejects.toThrow('Inconsistent fallback registration')
  })
})
