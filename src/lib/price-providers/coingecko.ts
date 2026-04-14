import type { FiatCurrency, PriceData, PriceProvider } from '@/types/price-providers'

const COINGECKO_API = 'https://api.coingecko.com/api/v3'

interface CoinGeckoPriceResponse {
  bitcoin: Record<string, number>
}

interface CoinGeckoChartResponse {
  prices: [number, number][]
}

async function fetchPrice(currency: FiatCurrency): Promise<PriceData> {
  const [priceResponse, chartResponse] = await Promise.all([
    fetch(
      `${COINGECKO_API}/simple/price?ids=bitcoin&vs_currencies=${currency}&include_24hr_change=true`
    ),
    fetch(`${COINGECKO_API}/coins/bitcoin/market_chart?vs_currency=${currency}&days=30`)
  ])

  if (!(priceResponse.ok && chartResponse.ok)) {
    throw new Error('Failed to fetch Bitcoin price from CoinGecko')
  }

  const priceData: CoinGeckoPriceResponse = await priceResponse.json()
  const chartData: CoinGeckoChartResponse = await chartResponse.json()

  const currentPrice = priceData.bitcoin[currency] ?? 0
  const changePercent24h = priceData.bitcoin[`${currency}_24h_change`] ?? 0

  const priceHistory = chartData.prices.map((point) => point[1])

  const previousPrice = currentPrice / (1 + changePercent24h / 100)
  const change24h = currentPrice - previousPrice

  return {
    change24h,
    changePercent24h,
    currentPrice,
    priceHistory
  }
}

export const coingeckoProvider: PriceProvider = {
  fetchPrice,
  id: 'coingecko',
  name: 'CoinGecko',
  refetchInterval: 60_000,
  staleTime: 30_000
}
