import type { FiatCurrency, PriceData, PriceProvider } from '@/types/price-providers'

const BINANCE_API = 'https://api.binance.com/api/v3'

const currencySymbols: Record<FiatCurrency, string> = {
  eur: 'EUR',
  usd: 'USDT'
}

interface BinanceTickerResponse {
  priceChange: string
  priceChangePercent: string
  lastPrice: string
}

type BinanceKline = [number, string, string, string, string, ...string[]]

async function fetchPrice(currency: FiatCurrency): Promise<PriceData> {
  const symbol = `BTC${currencySymbols[currency]}`

  const [tickerResponse, klinesResponse] = await Promise.all([
    fetch(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`),
    fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=1d&limit=30`)
  ])

  if (!(tickerResponse.ok && klinesResponse.ok)) {
    throw new Error('Failed to fetch Bitcoin price from Binance')
  }

  const ticker: BinanceTickerResponse = await tickerResponse.json()
  const klines: BinanceKline[] = await klinesResponse.json()

  const priceHistory = klines.map((kline) => Number.parseFloat(kline[4]))

  return {
    change24h: Number.parseFloat(ticker.priceChange),
    changePercent24h: Number.parseFloat(ticker.priceChangePercent),
    currentPrice: Number.parseFloat(ticker.lastPrice),
    priceHistory
  }
}

export const binanceProvider: PriceProvider = {
  fetchPrice,
  id: 'binance',
  name: 'Binance',
  refetchInterval: 30_000,
  staleTime: 10_000
}
