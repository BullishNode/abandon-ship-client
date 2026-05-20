import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { coingeckoProvider } from '../../../src/lib/price-providers/coingecko'

type FetchFn = (url: string) => Promise<Response>

function jsonResponse(body: unknown, ok = true, status?: number): Response {
  return Response.json(body, { status: status ?? (ok ? 200 : 500) })
}

const priceBody = {
  bitcoin: {
    usd: 50_000,
    usd_24h_change: 25
  }
}

const chartBody = {
  prices: [
    [1, 48_000],
    [2, 49_000],
    [3, 50_000]
  ]
}

describe('CoinGecko price provider', () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchFn>>

  beforeEach(() => {
    fetchMock = vi.fn<FetchFn>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes provider metadata', () => {
    expect(coingeckoProvider.id).toBe('coingecko')
    expect(coingeckoProvider.name).toBe('CoinGecko')
  })

  it('parses price + chart and derives change24h from changePercent', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(priceBody))
      .mockResolvedValueOnce(jsonResponse(chartBody))
    const result = await coingeckoProvider.fetchPrice('usd')
    expect(result.currentPrice).toBe(50_000)
    expect(result.changePercent24h).toBe(25)
    expect(result.priceHistory).toStrictEqual([48_000, 49_000, 50_000])
    expect(result.change24h).toBeCloseTo(10_000, 5)
  })

  it('queries the requested currency', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(priceBody))
      .mockResolvedValueOnce(jsonResponse(chartBody))
    await coingeckoProvider.fetchPrice('usd')
    expect(fetchMock.mock.calls[0][0]).toContain('vs_currencies=usd')
  })

  it('defaults missing fields to 0', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ bitcoin: {} }))
      .mockResolvedValueOnce(jsonResponse({ prices: [] }))
    const result = await coingeckoProvider.fetchPrice('eur')
    expect(result.currentPrice).toBe(0)
    expect(result.changePercent24h).toBe(0)
    expect(result.change24h).toBe(0)
    expect(result.priceHistory).toStrictEqual([])
  })

  it('throws when price response is not ok', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, false, 500))
      .mockResolvedValueOnce(jsonResponse(chartBody))
    await expect(coingeckoProvider.fetchPrice('usd')).rejects.toThrow(/CoinGecko/u)
  })

  it('throws when chart response is not ok', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(priceBody))
      .mockResolvedValueOnce(jsonResponse({}, false, 503))
    await expect(coingeckoProvider.fetchPrice('usd')).rejects.toThrow(/CoinGecko/u)
  })
})
