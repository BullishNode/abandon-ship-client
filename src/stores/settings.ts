import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BitcoinUnit } from '@/types/bitcoin'
import type { FiatCurrency, PriceProviderId } from '@/types/price-providers'

interface SettingsStore {
  priceProvider: PriceProviderId
  setPriceProvider: (provider: PriceProviderId) => void
  fiatCurrency: FiatCurrency
  setFiatCurrency: (currency: FiatCurrency) => void
  bitcoinUnit: BitcoinUnit
  setBitcoinUnit: (unit: BitcoinUnit) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      priceProvider: 'binance',
      setPriceProvider: (priceProvider) => set({ priceProvider }),
      fiatCurrency: 'usd',
      setFiatCurrency: (fiatCurrency) => set({ fiatCurrency }),
      bitcoinUnit: 'sats',
      setBitcoinUnit: (bitcoinUnit) => set({ bitcoinUnit })
    }),
    {
      name: 'bark-web-settings-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
