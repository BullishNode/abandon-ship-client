import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions } from '@tanstack/react-query'
import { binanceProvider } from '@/lib/price-providers/binance'
import { coingeckoProvider } from '@/lib/price-providers/coingecko'
import { useSettingsStore } from '@/stores/settings'
import type { PriceData, PriceProvider } from '@/types/price-providers'

const providers: Record<string, PriceProvider> = {
  binance: binanceProvider,
  coingecko: coingeckoProvider
}

export function useBitcoinPrice(
  options?: Omit<UseQueryOptions<PriceData>, 'queryKey' | 'queryFn'>
) {
  const priceProviderId = useSettingsStore((state) => state.priceProvider)
  const fiatCurrency = useSettingsStore((state) => state.fiatCurrency)
  const provider = providers[priceProviderId]

  return useQuery({
    queryFn: async () => provider.fetchPrice(fiatCurrency),
    queryKey: ['bitcoin', 'price', priceProviderId, fiatCurrency],
    refetchInterval: provider.refetchInterval,
    staleTime: provider.staleTime,
    ...options
  })
}
