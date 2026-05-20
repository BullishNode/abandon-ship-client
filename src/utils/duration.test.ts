import { describe, expect, it } from 'vitest'
import { parseDurationToMs } from './duration'

describe(parseDurationToMs, () => {
  it('parses seconds', () => {
    expect(parseDurationToMs('30s')).toBe(30_000)
  })

  it('parses minutes', () => {
    expect(parseDurationToMs('5m')).toBe(300_000)
  })

  it('parses hours', () => {
    expect(parseDurationToMs('2h')).toBe(7_200_000)
  })

  it('parses days', () => {
    expect(parseDurationToMs('1d')).toBe(86_400_000)
  })

  it('parses milliseconds', () => {
    expect(parseDurationToMs('500ms')).toBe(500)
  })

  it('parses decimal values', () => {
    expect(parseDurationToMs('1.5m')).toBe(90_000)
  })

  it('is case insensitive', () => {
    expect(parseDurationToMs('10S')).toBe(10_000)
    expect(parseDurationToMs('2H')).toBe(7_200_000)
  })

  it('trims whitespace', () => {
    expect(parseDurationToMs('  3m  ')).toBe(180_000)
  })

  it('returns undefined for unknown units', () => {
    expect(parseDurationToMs('5y')).toBeUndefined()
  })

  it('returns undefined for missing unit', () => {
    expect(parseDurationToMs('42')).toBeUndefined()
  })

  it('returns undefined for empty input', () => {
    expect(parseDurationToMs('')).toBeUndefined()
  })

  it('returns undefined for nullish input', () => {
    const maybeString: string | undefined = undefined
    expect(parseDurationToMs(maybeString)).toBeUndefined()
    expect(parseDurationToMs(null)).toBeUndefined()
  })

  it('returns undefined for garbage input', () => {
    expect(parseDurationToMs('abc')).toBeUndefined()
    expect(parseDurationToMs('5m extra')).toBeUndefined()
  })
})
