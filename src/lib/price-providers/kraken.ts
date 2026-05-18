import i18n from '@/i18n'
import type { FiatCurrency, PriceData, PriceProvider } from '@/types/price-providers'

const KRAKEN_API = 'https://api.kraken.com/0/public'
const OHLC_INTERVAL_DAILY = 1440
const PRICE_HISTORY_DAYS = 30

const currencySymbols: Record<FiatCurrency, string> = {
  eur: 'XBTEUR',
  usd: 'XBTUSD'
}

interface KrakenTickerPair {
  c: [string, string]
  o: string
}

interface KrakenTickerResponse {
  error: string[]
  result: Record<string, KrakenTickerPair>
}

type KrakenOHLCEntry = [number, string, string, string, string, string, string, number]

interface KrakenOHLCResponse {
  error: string[]
  result: Record<string, KrakenOHLCEntry[] | number>
}

function findTickerPair(result: Record<string, KrakenTickerPair>): KrakenTickerPair | undefined {
  for (const [key, value] of Object.entries(result)) {
    if (key !== 'last') {
      return value
    }
  }
  return undefined
}

function findOhlcEntries(
  result: Record<string, KrakenOHLCEntry[] | number>
): KrakenOHLCEntry[] | undefined {
  for (const [key, value] of Object.entries(result)) {
    if (key !== 'last' && Array.isArray(value)) {
      return value
    }
  }
  return undefined
}

async function fetchPrice(currency: FiatCurrency): Promise<PriceData> {
  const pair = currencySymbols[currency]

  const [tickerResponse, ohlcResponse] = await Promise.all([
    fetch(`${KRAKEN_API}/Ticker?pair=${pair}`),
    fetch(`${KRAKEN_API}/OHLC?pair=${pair}&interval=${OHLC_INTERVAL_DAILY}`)
  ])

  if (!(tickerResponse.ok && ohlcResponse.ok)) {
    throw new Error(i18n.t('errors.price_fetch_failed', { provider: 'Kraken' }))
  }

  const [tickerData, ohlcData]: [KrakenTickerResponse, KrakenOHLCResponse] = await Promise.all([
    tickerResponse.json(),
    ohlcResponse.json()
  ])

  if (tickerData.error.length > 0 || ohlcData.error.length > 0) {
    throw new Error(i18n.t('errors.price_fetch_failed', { provider: 'Kraken' }))
  }

  const tickerPair = findTickerPair(tickerData.result)
  const ohlcEntries = findOhlcEntries(ohlcData.result)

  if (!tickerPair || !ohlcEntries) {
    throw new Error(i18n.t('errors.price_fetch_failed', { provider: 'Kraken' }))
  }

  const currentPrice = Number.parseFloat(tickerPair.c[0])
  const openPrice24h = Number.parseFloat(tickerPair.o)
  const change24h = currentPrice - openPrice24h
  const changePercent24h = openPrice24h === 0 ? 0 : (change24h / openPrice24h) * 100

  const priceHistory = ohlcEntries
    .slice(-PRICE_HISTORY_DAYS)
    .map((entry) => Number.parseFloat(entry[4]))

  return {
    change24h,
    changePercent24h,
    currentPrice,
    priceHistory
  }
}

export const krakenProvider: PriceProvider = {
  fetchPrice,
  id: 'kraken',
  name: 'Kraken',
  refetchInterval: 60_000,
  staleTime: 30_000
}
