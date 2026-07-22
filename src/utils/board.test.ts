import { describe, expect, it } from 'vitest'
import { validateBoardAmount } from './board'

describe(validateBoardAmount, () => {
  it('returns empty for missing or non-positive amounts', () => {
    expect(validateBoardAmount(undefined, 100_000, 5000)).toBe('empty')
    expect(validateBoardAmount(0, 100_000, 5000)).toBe('empty')
  })

  it('returns insufficient_funds when amount exceeds spendable balance', () => {
    expect(validateBoardAmount(200_000, 100_000, 5000)).toBe('insufficient_funds')
  })

  it('returns below_min when amount is under the minimum board amount', () => {
    expect(validateBoardAmount(4999, 100_000, 5000)).toBe('below_min')
  })

  it('returns below_dust when the net amount after fees is under dust', () => {
    expect(validateBoardAmount(500, 100_000, undefined, 200)).toBe('below_dust')
  })

  it('returns valid when the net amount is unknown but local checks pass', () => {
    expect(validateBoardAmount(50_000, 100_000, 5000)).toBe('valid')
  })

  it('returns valid when the net amount clears dust', () => {
    expect(validateBoardAmount(50_000, 100_000, 5000, 49_000)).toBe('valid')
  })
})
