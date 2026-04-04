import type {
  FiatCurrency,
  PriceData,
  PriceProvider
} from '@/types/price-providers'

const BINANCE_API = 'https://api.binance.com/api/v3'

const currencySymbols: Record<FiatCurrency, string> = {
  usd: 'USDT',
  eur: 'EUR'
}

async function fetchPrice(currency: FiatCurrency): Promise<PriceData> {
  const symbol = `BTC${currencySymbols[currency]}`

  const [tickerResponse, klinesResponse] = await Promise.all([
    fetch(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`),
    fetch(`${BINANCE_API}/klines?symbol=${symbol}&interval=1d&limit=30`)
  ])

  if (!(tickerResponse.ok && klinesResponse.ok)) {
    throw new Error('Failed to fetch Bitcoin price from Binance')
  }

  const ticker = await tickerResponse.json()
  const klines = await klinesResponse.json()

  const priceHistory = klines.map((kline: (string | number)[]) =>
    Number.parseFloat(kline[4] as string)
  )

  return {
    currentPrice: Number.parseFloat(ticker.lastPrice),
    priceHistory,
    change24h: Number.parseFloat(ticker.priceChange),
    changePercent24h: Number.parseFloat(ticker.priceChangePercent)
  }
}

export const binanceProvider: PriceProvider = {
  id: 'binance',
  name: 'Binance',
  fetchPrice,
  refetchInterval: 30_000,
  staleTime: 10_000
}
