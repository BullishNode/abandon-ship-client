import type { BitcoinUnit } from '@/types/bitcoin'
import type { FiatCurrency } from '@/types/price-providers'
import { satsToBTC } from './bitcoin'

const TRAILING_ZEROS_REGEX = /\.?0+$/u
const NON_DIGIT_REGEX = /\D/gu

export const PRIVACY_MASK = '•••••'

export function parseSatsInput(value: string): string {
  const digits = value.replace(NON_DIGIT_REGEX, '')
  if (digits === '') {
    return ''
  }
  return String(Number.parseInt(digits, 10))
}

export function formatSatsDisplay(value: string): string {
  if (value === '') {
    return ''
  }
  const n = Number.parseInt(value, 10)
  if (Number.isNaN(n)) {
    return value
  }
  return new Intl.NumberFormat(undefined).format(n)
}

export function formatCurrency(value: number, currency: FiatCurrency): string {
  return new Intl.NumberFormat(undefined, {
    currency: currency.toUpperCase(),
    style: 'currency'
  }).format(value)
}

export function formatBitcoin(sats: number, unit: BitcoinUnit) {
  const formatter = new Intl.NumberFormat(undefined)

  if (unit === 'sats') {
    return formatter.format(sats)
  }

  const btc = satsToBTC(sats)
  const formatted = btc.toFixed(8).replace(TRAILING_ZEROS_REGEX, '')
  const [integerPart, decimalPart] = formatted.split('.')

  const formattedInteger = formatter.format(Number(integerPart))

  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`
  }

  return formattedInteger
}

export function formatAddress(address: string, startChars = 7, endChars = 7): string {
  if (address.length <= startChars + endChars) {
    return address
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}
