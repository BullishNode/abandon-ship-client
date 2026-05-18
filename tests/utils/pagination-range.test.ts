import { describe, expect, it } from 'vitest'
import { getPaginationRange } from '../../src/utils/pagination-range'

describe(getPaginationRange, () => {
  it('returns every page when total is within slot count', () => {
    expect(getPaginationRange(1, 5)).toStrictEqual([1, 2, 3, 4, 5])
    expect(getPaginationRange(3, 7)).toStrictEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('shows right ellipsis when current is near the start', () => {
    expect(getPaginationRange(1, 20)).toStrictEqual([1, 2, 'ellipsis', 20])
    expect(getPaginationRange(2, 20)).toStrictEqual([1, 2, 3, 'ellipsis', 20])
  })

  it('shows left ellipsis when current is near the end', () => {
    expect(getPaginationRange(20, 20)).toStrictEqual([1, 'ellipsis', 19, 20])
    expect(getPaginationRange(19, 20)).toStrictEqual([1, 'ellipsis', 18, 19, 20])
  })

  it('shows both ellipses when current is in the middle', () => {
    expect(getPaginationRange(10, 20)).toStrictEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20])
  })

  it('returns an empty array for zero total pages', () => {
    expect(getPaginationRange(1, 0)).toStrictEqual([])
  })
})
