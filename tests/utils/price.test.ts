import { describe, expect, it } from 'vitest'
import { sanitizePriceData } from '../../src/utils/price'
import type { PriceData } from '../../src/types/price-providers'

function makePriceData(overrides: Partial<PriceData> = {}): PriceData {
  return {
    change24h: 1200,
    changePercent24h: 1.2,
    currentPrice: 100_000,
    priceHistory: [98_000, 99_000, 100_000],
    ...overrides
  }
}

describe(sanitizePriceData, () => {
  it('returns the data unchanged when all fields are valid', () => {
    const data = makePriceData()
    expect(sanitizePriceData(data)).toStrictEqual(data)
  })

  it('returns undefined when currentPrice is NaN', () => {
    expect(sanitizePriceData(makePriceData({ currentPrice: Number.NaN }))).toBeUndefined()
  })

  it('returns undefined when currentPrice is Infinity', () => {
    expect(
      sanitizePriceData(makePriceData({ currentPrice: Number.POSITIVE_INFINITY }))
    ).toBeUndefined()
  })

  it('returns undefined when currentPrice is zero', () => {
    expect(sanitizePriceData(makePriceData({ currentPrice: 0 }))).toBeUndefined()
  })

  it('returns undefined when currentPrice is negative', () => {
    expect(sanitizePriceData(makePriceData({ currentPrice: -1 }))).toBeUndefined()
  })

  it('returns undefined when change24h is not finite', () => {
    expect(sanitizePriceData(makePriceData({ change24h: Number.NaN }))).toBeUndefined()
  })

  it('returns undefined when changePercent24h is not finite', () => {
    expect(
      sanitizePriceData(makePriceData({ changePercent24h: Number.NEGATIVE_INFINITY }))
    ).toBeUndefined()
  })

  it('filters non-finite entries out of priceHistory', () => {
    const data = makePriceData({
      priceHistory: [98_000, Number.NaN, 99_000, Number.POSITIVE_INFINITY]
    })
    expect(sanitizePriceData(data)?.priceHistory).toStrictEqual([98_000, 99_000])
  })

  it('does not mutate the input', () => {
    const data = makePriceData({ priceHistory: [Number.NaN, 99_000] })
    sanitizePriceData(data)
    expect(data.priceHistory).toStrictEqual([Number.NaN, 99_000])
  })
})
