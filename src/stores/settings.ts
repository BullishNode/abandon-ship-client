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
  discreetMode: boolean
  setDiscreetMode: (value: boolean) => void
  toggleDiscreetMode: () => void
  hideRefreshMovements: boolean
  setHideRefreshMovements: (value: boolean) => void
  hideExitFeeMovements: boolean
  setHideExitFeeMovements: (value: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      bitcoinUnit: 'sats',
      discreetMode: false,
      fiatCurrency: 'usd',
      hideExitFeeMovements: true,
      hideRefreshMovements: true,
      priceProvider: 'kraken',
      setBitcoinUnit: (bitcoinUnit) => {
        set({ bitcoinUnit })
      },
      setDiscreetMode: (discreetMode) => {
        set({ discreetMode })
      },
      setFiatCurrency: (fiatCurrency) => {
        set({ fiatCurrency })
      },
      setHideExitFeeMovements: (hideExitFeeMovements) => {
        set({ hideExitFeeMovements })
      },
      setHideRefreshMovements: (hideRefreshMovements) => {
        set({ hideRefreshMovements })
      },
      setPriceProvider: (priceProvider) => {
        set({ priceProvider })
      },
      toggleDiscreetMode: () => {
        set((state) => ({ discreetMode: !state.discreetMode }))
      }
    }),
    {
      name: 'bark-web-settings-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
