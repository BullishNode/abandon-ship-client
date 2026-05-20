import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { krakenProvider } from '../../../src/lib/price-providers/kraken'

type FetchFn = (url: string) => Promise<Response>

function jsonResponse(body: unknown, ok = true, status?: number): Response {
  return Response.json(body, { status: status ?? (ok ? 200 : 500) })
}

function ohlcRow(close: string): [number, string, string, string, string, string, string, number] {
  return [0, '0', '0', '0', close, '0', '0', 0]
}

const tickerBody = {
  error: [],
  result: {
    XXBTZUSD: {
      c: ['50000', '0.1'],
      o: '49000'
    },
    last: 0
  }
}

const ohlcBody = {
  error: [],
  result: {
    XXBTZUSD: [ohlcRow('48000'), ohlcRow('49500'), ohlcRow('50000')],
    last: 12_345
  }
}

describe('Kraken price provider', () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchFn>>

  beforeEach(() => {
    fetchMock = vi.fn<FetchFn>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes provider metadata', () => {
    expect(krakenProvider.id).toBe('kraken')
    expect(krakenProvider.name).toBe('Kraken')
  })

  it('parses ticker into currentPrice and change24h from open', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse(ohlcBody))
    const result = await krakenProvider.fetchPrice('usd')
    expect(result.currentPrice).toBe(50_000)
    expect(result.change24h).toBe(1000)
    expect(result.changePercent24h).toBeCloseTo((1000 / 49_000) * 100, 5)
  })

  it('builds priceHistory from OHLC closing prices', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse(ohlcBody))
    const result = await krakenProvider.fetchPrice('usd')
    expect(result.priceHistory).toStrictEqual([48_000, 49_500, 50_000])
  })

  it('queries XBTUSD pair for usd', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse(ohlcBody))
    await krakenProvider.fetchPrice('usd')
    expect(fetchMock.mock.calls[0][0]).toContain('pair=XBTUSD')
    expect(fetchMock.mock.calls[1][0]).toContain('pair=XBTUSD')
  })

  it('queries XBTEUR pair for eur', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse(ohlcBody))
    await krakenProvider.fetchPrice('eur')
    expect(fetchMock.mock.calls[0][0]).toContain('pair=XBTEUR')
  })

  it('handles openPrice == 0 by returning 0% change', async () => {
    const zeroOpen = {
      error: [],
      result: {
        XXBTZUSD: { c: ['50000', '0'], o: '0' },
        last: 0
      }
    }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(zeroOpen))
      .mockResolvedValueOnce(jsonResponse(ohlcBody))
    const result = await krakenProvider.fetchPrice('usd')
    expect(result.changePercent24h).toBe(0)
    expect(result.change24h).toBe(50_000)
  })

  it('truncates OHLC to last 30 entries', async () => {
    const long = {
      error: [],
      result: {
        XXBTZUSD: Array.from({ length: 50 }, (_, i) => ohlcRow(String(i))),
        last: 0
      }
    }
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse(long))
    const result = await krakenProvider.fetchPrice('usd')
    expect(result.priceHistory).toHaveLength(30)
    expect(result.priceHistory[0]).toBe(20)
    expect(result.priceHistory.at(-1)).toBe(49)
  })

  it('throws when ticker http fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, false, 500))
      .mockResolvedValueOnce(jsonResponse(ohlcBody))
    await expect(krakenProvider.fetchPrice('usd')).rejects.toThrow(/Kraken/u)
  })

  it('throws when OHLC http fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse({}, false, 500))
    await expect(krakenProvider.fetchPrice('usd')).rejects.toThrow(/Kraken/u)
  })

  it('throws when ticker returns kraken error array', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: ['EAPI:Invalid'], result: {} }))
      .mockResolvedValueOnce(jsonResponse(ohlcBody))
    await expect(krakenProvider.fetchPrice('usd')).rejects.toThrow(/Kraken/u)
  })

  it('throws when OHLC returns kraken error array', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse({ error: ['EAPI:Invalid'], result: {} }))
    await expect(krakenProvider.fetchPrice('usd')).rejects.toThrow(/Kraken/u)
  })

  it('throws when ticker result has no pair', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: [], result: { last: 0 } }))
      .mockResolvedValueOnce(jsonResponse(ohlcBody))
    await expect(krakenProvider.fetchPrice('usd')).rejects.toThrow(/Kraken/u)
  })

  it('throws when OHLC result has no array entries', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse({ error: [], result: { last: 0 } }))
    await expect(krakenProvider.fetchPrice('usd')).rejects.toThrow(/Kraken/u)
  })
})
