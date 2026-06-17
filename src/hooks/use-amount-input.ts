import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SATOSHIS_PER_BTC } from '@/constants/btc'
import { useBitcoinPrice } from '@/hooks/price/use-bitcoin-price'
import { useFormatBitcoin } from '@/hooks/use-format-bitcoin'
import { useFormatFiat } from '@/hooks/use-format-fiat'
import { useSettingsStore } from '@/stores/settings'
import type { AmountEntryMode } from '@/types/bitcoin'
import { btcToSats } from '@/utils/bitcoin'
import {
  formatDecimalDisplay,
  formatSatsDisplay,
  parseBtcInput,
  parseFiatInput,
  parseSatsInput,
  satsToBtcInput
} from '@/utils/format'

const FIAT_DECIMAL_PLACES = 2

function fiatToSat(fiat: number, price: number): number {
  return Math.round((fiat / price) * SATOSHIS_PER_BTC)
}

function satToFiat(sat: number, price: number): string {
  return ((sat / SATOSHIS_PER_BTC) * price).toFixed(FIAT_DECIMAL_PLACES)
}

function parseSatString(value: string): number | undefined {
  const sat = Number.parseInt(value, 10)
  return Number.isNaN(sat) || sat <= 0 ? undefined : sat
}

function parsePositiveFloat(value: string): number | undefined {
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed
}

function parseFiatToSat(value: string, price: number): number | undefined {
  const fiat = parsePositiveFloat(value)
  if (fiat === undefined) {
    return undefined
  }
  const sat = fiatToSat(fiat, price)
  return sat <= 0 ? undefined : sat
}

function parseBtcToSat(value: string): number | undefined {
  const btc = parsePositiveFloat(value)
  if (btc === undefined) {
    return undefined
  }
  const sat = btcToSats(btc)
  return sat <= 0 ? undefined : sat
}

export function useAmountInput() {
  const { t } = useTranslation()
  const entryMode = useSettingsStore((state) => state.amountEntryMode)
  const setEntryMode = useSettingsStore((state) => state.setAmountEntryMode)
  const fiatCurrency = useSettingsStore((state) => state.fiatCurrency)
  const bitcoinUnit = useSettingsStore((state) => state.bitcoinUnit)
  const { data: btcPrice } = useBitcoinPrice()
  const formatBitcoin = useFormatBitcoin()
  const formatFiat = useFormatFiat()

  const [amount, setAmount] = useState('')
  const [modeOverride, setModeOverride] = useState<AmountEntryMode | undefined>()

  const price = btcPrice?.currentPrice
  const canUseFiat = price !== undefined
  const preferredMode = modeOverride ?? entryMode
  const activeMode: AmountEntryMode = canUseFiat && preferredMode === 'fiat' ? 'fiat' : 'bitcoin'
  const isFiat = activeMode === 'fiat' && price !== undefined
  const isBtcUnit = bitcoinUnit === 'btc'

  function bitcoinToSat(value: string): number | undefined {
    return isBtcUnit ? parseBtcToSat(value) : parseSatString(value)
  }

  function satToBitcoinInput(sat: number): string {
    return isBtcUnit ? satsToBtcInput(sat) : String(sat)
  }

  let validAmountSat: number | undefined
  let amountDisplay: string
  let secondaryDisplay: string
  if (isFiat) {
    validAmountSat = parseFiatToSat(amount, price)
    amountDisplay = formatDecimalDisplay(amount)
    secondaryDisplay = validAmountSat === undefined ? '' : formatBitcoin(validAmountSat)
  } else {
    validAmountSat = bitcoinToSat(amount)
    amountDisplay = isBtcUnit ? formatDecimalDisplay(amount) : formatSatsDisplay(amount)
    secondaryDisplay = validAmountSat === undefined ? '' : formatFiat(validAmountSat)
  }

  let unitLabel: string
  if (isFiat) {
    unitLabel = fiatCurrency.toUpperCase()
  } else if (isBtcUnit) {
    unitLabel = t('bitcoin.btc_unit')
  } else {
    unitLabel = t('bitcoin.sats_unit_other')
  }

  function handleAmountChange(value: string) {
    if (isFiat) {
      setAmount(parseFiatInput(value))
      return
    }
    setAmount(isBtcUnit ? parseBtcInput(value) : parseSatsInput(value))
  }

  function setAmountSat(sat: number) {
    setModeOverride('bitcoin')
    setAmount(satToBitcoinInput(sat))
  }

  function toggleMode() {
    if (price === undefined) {
      return
    }
    setModeOverride(undefined)
    if (isFiat) {
      const sat = parseFiatToSat(amount, price)
      setAmount(sat === undefined ? '' : satToBitcoinInput(sat))
      setEntryMode('bitcoin')
      return
    }
    const sat = bitcoinToSat(amount)
    setAmount(sat === undefined ? '' : satToFiat(sat, price))
    setEntryMode('fiat')
  }

  function reset() {
    setAmount('')
    setModeOverride(undefined)
  }

  return {
    amount,
    amountDisplay,
    canUseFiat,
    entryMode: activeMode,
    reset,
    secondaryDisplay,
    setAmount: handleAmountChange,
    setAmountSat,
    toggleMode,
    unitLabel,
    validAmountSat
  }
}
