import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '../../src/stores/settings'

function resetStore() {
  useSettingsStore.setState({
    bitcoinUnit: 'sats',
    discreteMode: false,
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

  it('updates hideRefreshMovements', () => {
    useSettingsStore.getState().setHideRefreshMovements(false)
    expect(useSettingsStore.getState().hideRefreshMovements).toBeFalsy()
  })

  it('updates discreteMode', () => {
    useSettingsStore.getState().setDiscreteMode(true)
    expect(useSettingsStore.getState().discreteMode).toBeTruthy()
  })

  it('toggles discreteMode', () => {
    useSettingsStore.getState().toggleDiscreteMode()
    expect(useSettingsStore.getState().discreteMode).toBeTruthy()
    useSettingsStore.getState().toggleDiscreteMode()
    expect(useSettingsStore.getState().discreteMode).toBeFalsy()
  })
})
