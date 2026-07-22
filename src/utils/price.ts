import type { PriceData } from '@/types/price-providers'

export function sanitizePriceData(data: PriceData): PriceData | undefined {
  if (!(Number.isFinite(data.currentPrice) && data.currentPrice > 0)) {
    return undefined
  }
  if (!(Number.isFinite(data.change24h) && Number.isFinite(data.changePercent24h))) {
    return undefined
  }
  return { ...data, priceHistory: data.priceHistory.filter((price) => Number.isFinite(price)) }
}
