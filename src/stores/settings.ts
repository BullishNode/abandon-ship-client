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
      bitcoinUnit: 'sats',
      fiatCurrency: 'usd',
      priceProvider: 'binance',
      setBitcoinUnit: (bitcoinUnit) => set({ bitcoinUnit }),
      setFiatCurrency: (fiatCurrency) => set({ fiatCurrency }),
      setPriceProvider: (priceProvider) => set({ priceProvider })
    }),
    {
      name: 'bark-web-settings-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
