import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '../../src/stores/settings'

function resetStore() {
  useSettingsStore.setState({
    amountEntryMode: 'bitcoin',
    bitcoinUnit: 'sats',
    discreetMode: false,
    fiatCurrency: 'usd',
    hideRefreshMovements: true,
    priceProvider: 'kraken'
  })
}

describe('settings store setters', () => {
  beforeEach(() => {
    resetStore()
  })

  it('updates priceProvider', () => {
    useSettingsStore.getState().setPriceProvider('coingecko')
    expect(useSettingsStore.getState().priceProvider).toBe('coingecko')
  })

  it('updates fiatCurrency', () => {
    useSettingsStore.getState().setFiatCurrency('eur')
    expect(useSettingsStore.getState().fiatCurrency).toBe('eur')
  })

  it('updates bitcoinUnit', () => {
    useSettingsStore.getState().setBitcoinUnit('btc')
    expect(useSettingsStore.getState().bitcoinUnit).toBe('btc')
  })

  it('updates amountEntryMode', () => {
    useSettingsStore.getState().setAmountEntryMode('fiat')
    expect(useSettingsStore.getState().amountEntryMode).toBe('fiat')
  })

  it('updates hideRefreshMovements', () => {
    useSettingsStore.getState().setHideRefreshMovements(false)
    expect(useSettingsStore.getState().hideRefreshMovements).toBeFalsy()
  })

  it('updates discreetMode', () => {
    useSettingsStore.getState().setDiscreetMode(true)
    expect(useSettingsStore.getState().discreetMode).toBeTruthy()
  })

  it('toggles discreetMode', () => {
    useSettingsStore.getState().toggleDiscreetMode()
    expect(useSettingsStore.getState().discreetMode).toBeTruthy()
    useSettingsStore.getState().toggleDiscreetMode()
    expect(useSettingsStore.getState().discreetMode).toBeFalsy()
  })
})
