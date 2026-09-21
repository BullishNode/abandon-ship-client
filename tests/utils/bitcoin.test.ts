import type { Destination } from 'bitcoin-decoder'
import { describe, expect, it } from 'vitest'
import {
  btcToSats,
  normalizeBitcoinAddress,
  normalizeDestination,
  satsToBTC
} from '../../src/utils/bitcoin'

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

    it('avoids floating-point truncation', () => {
      expect(btcToSats(0.29)).toBe(29_000_000)
      expect(btcToSats(0.57)).toBe(57_000_000)
      expect(btcToSats(0.07)).toBe(7_000_000)
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

  describe(normalizeBitcoinAddress, () => {
    it('lowercases an uppercase mainnet bech32 address', () => {
      const upper = 'BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ'
      expect(normalizeBitcoinAddress(upper)).toBe(upper.toLowerCase())
    })

    it('lowercases an uppercase taproot (bech32m) address', () => {
      const upper = 'BC1P0XLXVLHEMJA6C4DQV22UAPCTQUPFHLXM9H8Z3K2E72Q4K9HCZ7VQZK5JJ0'
      expect(normalizeBitcoinAddress(upper)).toBe(upper.toLowerCase())
    })

    it('lowercases uppercase signet/testnet bech32 addresses', () => {
      expect(normalizeBitcoinAddress('TB1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KXPJZSX')).toBe(
        'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
      )
    })

    it('lowercases uppercase regtest bech32 addresses', () => {
      expect(normalizeBitcoinAddress('BCRT1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7K35MRZD')).toBe(
        'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7k35mrzd'
      )
    })

    it('leaves an already lowercase bech32 address unchanged', () => {
      const lower = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
      expect(normalizeBitcoinAddress(lower)).toBe(lower)
    })

    it('preserves case of base58 legacy P2PKH addresses', () => {
      const legacy = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'
      expect(normalizeBitcoinAddress(legacy)).toBe(legacy)
    })

    it('preserves case of base58 legacy P2SH addresses', () => {
      const legacy = '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'
      expect(normalizeBitcoinAddress(legacy)).toBe(legacy)
    })
  })

  describe(normalizeDestination, () => {
    it('lowercases an uppercase bitcoin segwit address', () => {
      const dest: Destination = {
        addressType: 'p2wpkh',
        protocol: 'on-chain',
        type: 'bitcoin-address',
        value: 'BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ'
      }
      expect(normalizeDestination(dest).value).toBe('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')
    })

    it('preserves case of a base58 legacy bitcoin address', () => {
      const dest: Destination = {
        addressType: 'p2pkh',
        protocol: 'on-chain',
        type: 'bitcoin-address',
        value: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'
      }
      expect(normalizeDestination(dest).value).toBe('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')
    })

    it('lowercases an uppercase ark address', () => {
      const dest: Destination = {
        protocol: 'ark',
        type: 'ark-address',
        value: 'ARK1ABCDEF'
      }
      expect(normalizeDestination(dest).value).toBe('ark1abcdef')
    })

    it('lowercases an uppercase bolt11 invoice', () => {
      const dest: Destination = {
        protocol: 'lightning',
        type: 'bolt11',
        value: 'LNBC1ABCDEF'
      }
      expect(normalizeDestination(dest).value).toBe('lnbc1abcdef')
    })

    it('lowercases an uppercase bolt12 offer', () => {
      const dest: Destination = {
        protocol: 'lightning',
        type: 'bolt12',
        value: 'LNO1ABCDEF'
      }
      expect(normalizeDestination(dest).value).toBe('lno1abcdef')
    })

    it('lowercases a lightning address', () => {
      const dest: Destination = {
        protocol: 'lightning',
        type: 'lnaddress',
        value: 'Satoshi@Example.com'
      }
      expect(normalizeDestination(dest).value).toBe('satoshi@example.com')
    })

    it('preserves case of an lnurl', () => {
      const dest: Destination = {
        protocol: 'lightning',
        type: 'lnurl',
        value: 'LNURL1ABCDEF'
      }
      expect(normalizeDestination(dest).value).toBe('LNURL1ABCDEF')
    })

    it('keeps other destination fields intact', () => {
      const dest: Destination = {
        addressType: 'p2wpkh',
        protocol: 'on-chain',
        type: 'bitcoin-address',
        value: 'BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ'
      }
      const result = normalizeDestination(dest)
      expect(result.type).toBe('bitcoin-address')
      expect(result.protocol).toBe('on-chain')
    })
  })
})
