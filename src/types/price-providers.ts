export interface PriceData {
  currentPrice: number
  priceHistory: number[]
  change24h: number
  changePercent24h: number
}

export type FiatCurrency = 'usd' | 'eur'

export type PriceProviderId = 'binance' | 'coingecko' | 'kraken'

export interface PriceProvider {
  id: string
  name: string
  fetchPrice: (currency: FiatCurrency) => Promise<PriceData>
  refetchInterval: number
  staleTime: number
}
