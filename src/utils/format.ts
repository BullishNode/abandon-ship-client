import type { BitcoinUnit } from '@/types/bitcoin'
import type { FiatCurrency } from '@/types/price-providers'
import { satsToBTC } from './bitcoin'

const TRAILING_ZEROS_REGEX = /\.?0+$/u
const NON_DIGIT_REGEX = /\D/gu
const NON_DECIMAL_REGEX = /[^\d.]/gu
const LEADING_ZEROS_REGEX = /^0+(?=\d)/u
const FIAT_DECIMAL_PLACES = 2
const BTC_DECIMAL_PLACES = 8

export const PRIVACY_MASK = '-----'

const numberFormatter = new Intl.NumberFormat(undefined)
const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
  notation: 'compact'
})
const currencyFormatters = new Map<string, Intl.NumberFormat>()

function getCurrencyFormatter(currency: FiatCurrency): Intl.NumberFormat {
  const code = currency.toUpperCase()
  const cached = currencyFormatters.get(code)
  if (cached) {
    return cached
  }
  const formatter = new Intl.NumberFormat(undefined, {
    currency: code,
    style: 'currency'
  })
  currencyFormatters.set(code, formatter)
  return formatter
}

export function parseSatsInput(value: string): string {
  const digits = value.replace(NON_DIGIT_REGEX, '')
  if (digits === '') {
    return ''
  }
  return String(Number.parseInt(digits, 10))
}

function normalizeIntegerDigits(value: string): string {
  const trimmed = value.replace(LEADING_ZEROS_REGEX, '')
  return trimmed === '' ? '0' : trimmed
}

function parseDecimalInput(value: string, maxDecimals: number): string {
  const cleaned = value.replace(NON_DECIMAL_REGEX, '')
  if (cleaned === '') {
    return ''
  }
  const parts = cleaned.split('.')
  if (parts.length === 1) {
    return normalizeIntegerDigits(parts[0])
  }
  const intPart = normalizeIntegerDigits(parts[0])
  const decPart = parts.slice(1).join('').slice(0, maxDecimals)
  return `${intPart}.${decPart}`
}

export function parseFiatInput(value: string): string {
  return parseDecimalInput(value, FIAT_DECIMAL_PLACES)
}

export function parseBtcInput(value: string): string {
  return parseDecimalInput(value, BTC_DECIMAL_PLACES)
}

export function satsToBtcInput(sats: number): string {
  return satsToBTC(sats).toFixed(BTC_DECIMAL_PLACES).replace(TRAILING_ZEROS_REGEX, '')
}

export function formatDecimalDisplay(value: string): string {
  if (value === '') {
    return ''
  }
  const [intPart, decPart] = value.split('.')
  const intNum = Number.parseInt(intPart, 10)
  const formattedInt = Number.isNaN(intNum) ? '0' : numberFormatter.format(intNum)
  if (decPart === undefined) {
    return formattedInt
  }
  return `${formattedInt}.${decPart}`
}

export function formatSatsDisplay(value: string): string {
  if (value === '') {
    return ''
  }
  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n)) {
    return value
  }
  return numberFormatter.format(n)
}

export function formatCurrency(value: number, currency: FiatCurrency): string {
  return getCurrencyFormatter(currency).format(value)
}

export function formatBitcoin(sats: number, unit: BitcoinUnit) {
  if (unit === 'sats') {
    return numberFormatter.format(sats)
  }

  const btc = satsToBTC(sats)
  const formatted = btc.toFixed(8).replace(TRAILING_ZEROS_REGEX, '')
  const [integerPart, decimalPart] = formatted.split('.')

  const formattedInteger = numberFormatter.format(Number(integerPart))

  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`
  }

  return formattedInteger
}

export function formatBitcoinCompact(sats: number, unit: BitcoinUnit) {
  if (unit === 'sats') {
    return compactNumberFormatter.format(sats)
  }
  return formatBitcoin(sats, unit)
}

export function formatAddress(address: string, startChars = 7, endChars = 7): string {
  if (address.length <= startChars + endChars) {
    return address
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}
