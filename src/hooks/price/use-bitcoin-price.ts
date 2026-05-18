import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'
import { binanceProvider } from '@/lib/price-providers/binance'
import { coingeckoProvider } from '@/lib/price-providers/coingecko'
import { krakenProvider } from '@/lib/price-providers/kraken'
import { bitcoinKeys } from '@/lib/query-keys'
import { useSettingsStore } from '@/stores/settings'
import type { PriceData, PriceProvider } from '@/types/price-providers'

const providers: Record<string, PriceProvider> = {
  binance: binanceProvider,
  coingecko: coingeckoProvider,
  kraken: krakenProvider
}

export function useBitcoinPrice(
  options?: Omit<UseQueryOptions<PriceData>, 'queryKey' | 'queryFn'>
) {
  const [priceProviderId, fiatCurrency] = useSettingsStore(
    useShallow((state) => [state.priceProvider, state.fiatCurrency])
  )
  const provider = providers[priceProviderId]

  return useQuery({
    queryFn: async () => {
      const price = await provider.fetchPrice(fiatCurrency)
      return price
    },
    queryKey: bitcoinKeys.price(priceProviderId, fiatCurrency),
    refetchInterval: provider.refetchInterval,
    staleTime: provider.staleTime,
    ...options
  })
}
