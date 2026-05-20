import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { binanceProvider } from '../../../src/lib/price-providers/binance'

type FetchFn = (url: string) => Promise<Response>

function jsonResponse(body: unknown, ok = true, status?: number): Response {
  return Response.json(body, { status: status ?? (ok ? 200 : 500) })
}

const tickerBody = {
  lastPrice: '50000.5',
  priceChange: '1000.25',
  priceChangePercent: '2.04'
}

function klineRow(close: string): [number, string, string, string, string] {
  return [0, '0', '0', '0', close]
}

describe('Binance price provider', () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchFn>>

  beforeEach(() => {
    fetchMock = vi.fn<FetchFn>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes provider metadata', () => {
    expect(binanceProvider.id).toBe('binance')
    expect(binanceProvider.name).toBe('Binance')
    expect(binanceProvider.refetchInterval).toBeGreaterThan(0)
    expect(binanceProvider.staleTime).toBeGreaterThan(0)
  })

  it('parses ticker into change/price fields', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse([klineRow('49000'), klineRow('50000.5')]))
    const result = await binanceProvider.fetchPrice('usd')
    expect(result.currentPrice).toBe(50_000.5)
    expect(result.change24h).toBe(1000.25)
    expect(result.changePercent24h).toBe(2.04)
  })

  it('parses klines closing prices into priceHistory', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse([klineRow('49000'), klineRow('50000.5')]))
    const result = await binanceProvider.fetchPrice('usd')
    expect(result.priceHistory).toStrictEqual([49_000, 50_000.5])
  })

  it('queries USDT symbol for usd', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse([klineRow('50000')]))
    await binanceProvider.fetchPrice('usd')
    const ticker = fetchMock.mock.calls.find((call) => call[0].includes('/ticker/24hr'))
    const klines = fetchMock.mock.calls.find((call) => call[0].includes('/klines'))
    expect(ticker?.[0]).toContain('symbol=BTCUSDT')
    expect(klines?.[0]).toContain('symbol=BTCUSDT')
  })

  it('queries EUR symbol for eur', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse([klineRow('50000')]))
    await binanceProvider.fetchPrice('eur')
    const ticker = fetchMock.mock.calls.find((call) => call[0].includes('/ticker/24hr'))
    const klines = fetchMock.mock.calls.find((call) => call[0].includes('/klines'))
    expect(ticker?.[0]).toContain('symbol=BTCEUR')
    expect(klines?.[0]).toContain('symbol=BTCEUR')
  })

  it('throws when ticker response is not ok', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, false, 500))
      .mockResolvedValueOnce(jsonResponse([klineRow('50000')]))
    await expect(binanceProvider.fetchPrice('usd')).rejects.toThrow(/Binance/u)
  })

  it('throws when klines response is not ok', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tickerBody))
      .mockResolvedValueOnce(jsonResponse({}, false, 503))
    await expect(binanceProvider.fetchPrice('usd')).rejects.toThrow(/Binance/u)
  })
})
