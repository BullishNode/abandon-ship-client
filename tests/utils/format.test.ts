import { describe, expect, it } from 'vitest'
import { formatAddress, formatBitcoin, formatCurrency } from '../../src/utils/format'

describe('format utils', () => {
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
