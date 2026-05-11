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
  discreteMode: boolean
  setDiscreteMode: (value: boolean) => void
  toggleDiscreteMode: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      bitcoinUnit: 'sats',
      discreteMode: false,
      fiatCurrency: 'usd',
      priceProvider: 'binance',
      setBitcoinUnit: (bitcoinUnit) => {
        set({ bitcoinUnit })
      },
      setDiscreteMode: (discreteMode) => {
        set({ discreteMode })
      },
      setFiatCurrency: (fiatCurrency) => {
        set({ fiatCurrency })
      },
      setPriceProvider: (priceProvider) => {
        set({ priceProvider })
      },
      toggleDiscreteMode: () => {
        set((state) => ({ discreteMode: !state.discreteMode }))
      }
    }),
    {
      name: 'bark-web-settings-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
