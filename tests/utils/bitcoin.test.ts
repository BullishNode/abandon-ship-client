import { describe, expect, it } from 'vitest'
import { btcToSats, satsToBTC } from '../../src/utils/bitcoin'

describe('bitcoin utils', () => {
  describe(btcToSats, () => {
    it('converts 1 BTC to 100,000,000 sats', () => {
      expect(btcToSats(1)).toBe(100_000_000)
    })

    it('converts 0.5 BTC to 50,000,000 sats', () => {
      expect(btcToSats(0.5)).toBe(50_000_000)
    })

    it('converts 0.00000001 BTC (1 sat) to 1 sat', () => {
      expect(btcToSats(0.000_000_01)).toBe(1)
    })

    it('converts 0 BTC to 0 sats', () => {
      expect(btcToSats(0)).toBe(0)
    })

    it('handles small amounts correctly', () => {
      expect(btcToSats(0.001)).toBe(100_000)
    })
  })

  describe(satsToBTC, () => {
    it('converts 100,000,000 sats to 1 BTC', () => {
      expect(satsToBTC(100_000_000)).toBe(1)
    })

    it('converts 50,000,000 sats to 0.5 BTC', () => {
      expect(satsToBTC(50_000_000)).toBe(0.5)
    })

    it('converts 1 sat to 0.00000001 BTC', () => {
      expect(satsToBTC(1)).toBe(0.000_000_01)
    })

    it('converts 0 sats to 0 BTC', () => {
      expect(satsToBTC(0)).toBe(0)
    })

    it('handles large amounts', () => {
      expect(satsToBTC(2_100_000_000_000_000)).toBe(21_000_000)
    })
  })
})
