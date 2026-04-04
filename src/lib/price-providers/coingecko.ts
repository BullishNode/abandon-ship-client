import type {
  FiatCurrency,
  PriceData,
  PriceProvider
} from '@/types/price-providers'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'

async function fetchPrice(currency: FiatCurrency): Promise<PriceData> {
  const [priceResponse, chartResponse] = await Promise.all([
    fetch(
      `${COINGECKO_API}/simple/price?ids=bitcoin&vs_currencies=${currency}&include_24hr_change=true`
    ),
    fetch(
      `${COINGECKO_API}/coins/bitcoin/market_chart?vs_currency=${currency}&days=30`
    )
  ])

  if (!(priceResponse.ok && chartResponse.ok)) {
    throw new Error('Failed to fetch Bitcoin price from CoinGecko')
  }

  const priceData = await priceResponse.json()
  const chartData = await chartResponse.json()

  const currentPrice = priceData.bitcoin[currency]
  const changePercent24h = priceData.bitcoin[`${currency}_24h_change`]

  // Chart data prices format: [[timestamp, price], ...]
  const priceHistory = chartData.prices.map(
    (point: [number, number]) => point[1]
  )

  // Calculate 24h change
  const previousPrice = currentPrice / (1 + changePercent24h / 100)
  const change24h = currentPrice - previousPrice

  return {
    currentPrice,
    priceHistory,
    change24h,
    changePercent24h
  }
}

export const coingeckoProvider: PriceProvider = {
  id: 'coingecko',
  name: 'CoinGecko',
  fetchPrice,
  refetchInterval: 60_000,
  staleTime: 30_000
}
