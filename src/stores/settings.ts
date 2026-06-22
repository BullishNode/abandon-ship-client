import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AmountEntryMode, BitcoinUnit } from '@/types/bitcoin'
import type { FiatCurrency, PriceProviderId } from '@/types/price-providers'
import type { Theme } from '@/types/theme'

interface SettingsStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  priceProvider: PriceProviderId
  setPriceProvider: (provider: PriceProviderId) => void
  fiatCurrency: FiatCurrency
  setFiatCurrency: (currency: FiatCurrency) => void
  bitcoinUnit: BitcoinUnit
  setBitcoinUnit: (unit: BitcoinUnit) => void
  amountEntryMode: AmountEntryMode
  setAmountEntryMode: (mode: AmountEntryMode) => void
  discreetMode: boolean
  setDiscreetMode: (value: boolean) => void
  toggleDiscreetMode: () => void
  hideRefreshMovements: boolean
  setHideRefreshMovements: (value: boolean) => void
  hideExitFeeMovements: boolean
  setHideExitFeeMovements: (value: boolean) => void
  showExitedVtxos: boolean
  setShowExitedVtxos: (value: boolean) => void
  autoRefreshThresholdBlocks: number
  setAutoRefreshThresholdBlocks: (value: number) => void
  refreshOnReceive: boolean
  setRefreshOnReceive: (value: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      amountEntryMode: 'bitcoin',
      autoRefreshThresholdBlocks: 0,
      bitcoinUnit: 'sats',
      discreetMode: false,
      fiatCurrency: 'usd',
      hideExitFeeMovements: true,
      hideRefreshMovements: true,
      priceProvider: 'kraken',
      refreshOnReceive: false,
      setAmountEntryMode: (amountEntryMode) => {
        set({ amountEntryMode })
      },
      setAutoRefreshThresholdBlocks: (autoRefreshThresholdBlocks) => {
        set({ autoRefreshThresholdBlocks })
      },
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
      setRefreshOnReceive: (refreshOnReceive) => {
        set({ refreshOnReceive })
      },
      setShowExitedVtxos: (showExitedVtxos) => {
        set({ showExitedVtxos })
      },
      setTheme: (theme) => {
        set({ theme })
      },
      showExitedVtxos: false,
      theme: 'system',
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
