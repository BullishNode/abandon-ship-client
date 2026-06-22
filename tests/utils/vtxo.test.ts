import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getExpiryTimeLabel } from '../../src/utils/vtxo'

const t = i18next.t.bind(i18next)

describe(getExpiryTimeLabel, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty string when the tip height is unknown', () => {
    expect(getExpiryTimeLabel(1000, t)).toBe('')
  })

  it('returns the expired label when the expiry height is at or below the tip', () => {
    expect(getExpiryTimeLabel(1000, t, 1000)).toBe('Expired')
    expect(getExpiryTimeLabel(900, t, 1000)).toBe('Expired')
  })

  it('estimates hours from the remaining blocks at ten minutes per block', () => {
    const result = getExpiryTimeLabel(1006, t, 1000)
    expect(result).toContain('1')
    expect(result).toContain('hour')
  })

  it('estimates minutes when less than an hour remains', () => {
    const result = getExpiryTimeLabel(1003, t, 1000)
    expect(result).toContain('30')
    expect(result).toContain('minute')
  })

  it('marks the estimate with a tilde before the number', () => {
    const result = getExpiryTimeLabel(1006, t, 1000)
    expect(result).toContain('~1')
    expect(result.startsWith('~')).toBeFalsy()
  })
})
