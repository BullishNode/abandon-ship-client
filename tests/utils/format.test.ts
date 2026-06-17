import { describe, expect, it } from 'vitest'
import {
  formatAddress,
  formatBitcoin,
  formatCurrency,
  formatDecimalDisplay,
  formatSatsDisplay,
  parseBtcInput,
  parseFiatInput,
  parseSatsInput,
  satsToBtcInput
} from '../../src/utils/format'

describe('format utils', () => {
  describe(parseSatsInput, () => {
    it('strips non-digit characters', () => {
      expect(parseSatsInput('1,234.56 sats')).toBe('123456')
    })

    it('returns empty string for input with no digits', () => {
      expect(parseSatsInput('abc')).toBe('')
    })

    it('returns empty string for an empty input', () => {
      expect(parseSatsInput('')).toBe('')
    })

    it('drops leading zeros', () => {
      expect(parseSatsInput('00042')).toBe('42')
    })

    it('returns "0" when input collapses to a single zero', () => {
      expect(parseSatsInput('abc0')).toBe('0')
    })
  })

  describe(parseFiatInput, () => {
    it('keeps a plain integer', () => {
      expect(parseFiatInput('1234')).toBe('1234')
    })

    it('strips non-numeric characters but keeps the decimal point', () => {
      expect(parseFiatInput('$1,2a3.4')).toBe('123.4')
    })

    it('clamps to two decimal places', () => {
      expect(parseFiatInput('12.3456')).toBe('12.34')
    })

    it('collapses extra decimal points', () => {
      expect(parseFiatInput('12.3.4')).toBe('12.34')
    })

    it('drops leading zeros on the integer part', () => {
      expect(parseFiatInput('007')).toBe('7')
    })

    it('preserves a single zero before the decimal point', () => {
      expect(parseFiatInput('0.5')).toBe('0.5')
    })

    it('defaults the integer part to zero when only a point is typed', () => {
      expect(parseFiatInput('.')).toBe('0.')
    })

    it('returns an empty string when there are no usable characters', () => {
      expect(parseFiatInput('abc')).toBe('')
    })
  })

  describe(parseBtcInput, () => {
    it('keeps up to eight decimal places', () => {
      expect(parseBtcInput('0.123456789')).toBe('0.12345678')
    })

    it('parses a typical btc amount', () => {
      expect(parseBtcInput('0.004')).toBe('0.004')
    })

    it('strips non-numeric characters', () => {
      expect(parseBtcInput('₿0.5x')).toBe('0.5')
    })

    it('returns an empty string when there are no usable characters', () => {
      expect(parseBtcInput('abc')).toBe('')
    })
  })

  describe(satsToBtcInput, () => {
    it('converts sats to a btc string without trailing zeros', () => {
      expect(satsToBtcInput(400_000)).toBe('0.004')
    })

    it('converts one whole btc', () => {
      expect(satsToBtcInput(100_000_000)).toBe('1')
    })

    it('converts a single sat', () => {
      expect(satsToBtcInput(1)).toBe('0.00000001')
    })
  })

  describe(formatDecimalDisplay, () => {
    it('returns an empty string for empty input', () => {
      expect(formatDecimalDisplay('')).toBe('')
    })

    it('groups the integer part', () => {
      const result = formatDecimalDisplay('1234567')
      expect(result).toContain('1')
      expect(result).toContain('234')
      expect(result).toContain('567')
    })

    it('preserves a trailing decimal point being typed', () => {
      expect(formatDecimalDisplay('12.')).toBe('12.')
    })

    it('preserves typed decimal digits', () => {
      expect(formatDecimalDisplay('12.50')).toBe('12.50')
    })
  })

  describe(formatSatsDisplay, () => {
    it('returns an empty string for empty input', () => {
      expect(formatSatsDisplay('')).toBe('')
    })

    it('returns the input as-is when it is not parseable as a number', () => {
      expect(formatSatsDisplay('abc')).toBe('abc')
    })

    it('formats a parseable number with grouping separators', () => {
      const result = formatSatsDisplay('1234567')
      expect(result).toContain('1')
      expect(result).toContain('234')
      expect(result).toContain('567')
    })
  })

  describe(formatCurrency, () => {
    it('formats a USD value', () => {
      const result = formatCurrency(1234.56, 'usd')
      expect(result).toContain('1')
      expect(result).toContain('234')
      expect(result).toContain('56')
    })

    it('formats a EUR value', () => {
      const result = formatCurrency(1234.56, 'eur')
      expect(result).toContain('1')
      expect(result).toContain('234')
      expect(result).toContain('56')
    })

    it('formats zero', () => {
      const result = formatCurrency(0, 'usd')
      expect(result).toContain('0')
    })

    it('formats large numbers with grouping', () => {
      const result = formatCurrency(1_000_000, 'usd')
      expect(result).toContain('1')
      expect(result).toContain('000')
    })
  })

  describe(formatBitcoin, () => {
    it('formats sats as a plain number', () => {
      const result = formatBitcoin(100_000, 'sats')
      expect(result).toContain('100')
      expect(result).toContain('000')
    })

    it('formats 0 sats', () => {
      expect(formatBitcoin(0, 'sats')).toBe('0')
    })

    it('formats 1 BTC correctly', () => {
      const result = formatBitcoin(100_000_000, 'btc')
      expect(result).toContain('1')
      expect(result).not.toContain('.')
    })

    it('formats fractional BTC removing trailing zeros', () => {
      const result = formatBitcoin(50_000_000, 'btc')
      expect(result).toBe('0.5')
    })

    it('formats 1 sat in BTC', () => {
      const result = formatBitcoin(1, 'btc')
      expect(result).toBe('0.00000001')
    })

    it('formats amounts with mixed decimals', () => {
      const result = formatBitcoin(12_345_678, 'btc')
      expect(result).toBe('0.12345678')
    })

    it('formats 0 sats as btc', () => {
      const result = formatBitcoin(0, 'btc')
      expect(result).toBe('0')
    })
  })

  describe(formatAddress, () => {
    it('truncates a long address with default parameters', () => {
      const address = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
      expect(formatAddress(address)).toBe('bc1qar0...zwf5mdq')
    })

    it('returns the full address if shorter than startChars + endChars', () => {
      const shortAddress = 'bc1qar0srrr'
      expect(formatAddress(shortAddress)).toBe(shortAddress)
    })

    it('returns the full address when length equals startChars + endChars', () => {
      const exactAddress = 'bc1qar0srrr7'
      expect(formatAddress(exactAddress)).toBe(exactAddress)
    })

    it('uses custom startChars parameter', () => {
      const address = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
      expect(formatAddress(address, 4)).toBe('bc1q...zwf5mdq')
    })

    it('uses custom endChars parameter', () => {
      const address = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
      expect(formatAddress(address, 6, 4)).toBe('bc1qar...5mdq')
    })

    it('handles custom startChars and endChars together', () => {
      const address = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
      expect(formatAddress(address, 3, 3)).toBe('bc1...mdq')
    })

    it('handles empty string', () => {
      expect(formatAddress('')).toBe('')
    })
  })
})
