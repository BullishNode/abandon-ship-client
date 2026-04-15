import { describe, expect, it } from 'vitest'
import { shuffleArray } from '../../src/utils/shuffle-array'

describe(shuffleArray, () => {
  it('returns an array of the same length', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffleArray(input)
    expect(result).toHaveLength(input.length)
  })

  it('contains the same elements as the original', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffleArray(input)
    expect([...result].toSorted((a, b) => a - b)).toStrictEqual(
      [...input].toSorted((a, b) => a - b)
    )
  })

  it('does not mutate the original array', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    shuffleArray(input)
    expect(input).toStrictEqual(copy)
  })

  it('returns a new array reference', () => {
    const input = [1, 2, 3]
    const result = shuffleArray(input)
    expect(result).not.toBe(input)
  })

  it('handles an empty array', () => {
    expect(shuffleArray([])).toStrictEqual([])
  })

  it('handles a single-element array', () => {
    expect(shuffleArray([42])).toStrictEqual([42])
  })

  it('works with string arrays', () => {
    const input = ['a', 'b', 'c', 'd']
    const result = shuffleArray(input)
    expect([...result].toSorted((a, b) => a.localeCompare(b))).toStrictEqual(
      [...input].toSorted((a, b) => a.localeCompare(b))
    )
  })
})
