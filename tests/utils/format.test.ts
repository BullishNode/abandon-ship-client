import { describe, expect, it } from 'vitest'
import { formatAddress } from '../../src/utils/format'

describe('format utils', () => {
  describe('formatAddress', () => {
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
