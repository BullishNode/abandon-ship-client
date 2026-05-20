import { afterEach, beforeEach, describe, expect, it, vi, expectTypeOf } from 'vitest'
import { formatAbsoluteDateTime, formatRelativeTime } from '../../src/utils/relative-time'

describe(formatRelativeTime, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats seconds ago', () => {
    const date = new Date('2026-01-15T11:59:30Z')
    const result = formatRelativeTime(date)
    expect(result).toContain('30')
    expect(result).toContain('second')
  })

  it('formats minutes ago', () => {
    const date = new Date('2026-01-15T11:55:00Z')
    const result = formatRelativeTime(date)
    expect(result).toContain('5')
    expect(result).toContain('minute')
  })

  it('formats hours ago', () => {
    const date = new Date('2026-01-15T09:00:00Z')
    const result = formatRelativeTime(date)
    expect(result).toContain('3')
    expect(result).toContain('hour')
  })

  it('formats days ago', () => {
    const date = new Date('2026-01-13T12:00:00Z')
    const result = formatRelativeTime(date)
    expect(result).toContain('2')
    expect(result).toContain('day')
  })

  it('formats weeks ago', () => {
    const date = new Date('2026-01-01T12:00:00Z')
    const result = formatRelativeTime(date)
    expect(result).toContain('2')
    expect(result).toContain('week')
  })

  it('formats months ago', () => {
    const date = new Date('2025-11-15T12:00:00Z')
    const result = formatRelativeTime(date)
    expect(result).toContain('2')
    expect(result).toContain('month')
  })

  it('formats years ago', () => {
    const date = new Date('2024-01-15T12:00:00Z')
    const result = formatRelativeTime(date)
    expect(result).toContain('2')
    expect(result).toContain('year')
  })

  it('formats future dates', () => {
    const date = new Date('2026-01-15T12:05:00Z')
    const result = formatRelativeTime(date)
    expect(result).toContain('5')
    expect(result).toContain('minute')
  })

  it('returns a string', () => {
    const result = formatRelativeTime(new Date())
    expectTypeOf(result).toBeString()
  })

  it('caches the relative formatter per locale across calls', () => {
    const date = new Date('2026-01-15T11:55:00Z')
    const first = formatRelativeTime(date, 'en-US')
    const second = formatRelativeTime(date, 'en-US')
    expect(first).toBe(second)
  })

  it('honors the locale argument', () => {
    const date = new Date('2026-01-15T11:55:00Z')
    const en = formatRelativeTime(date, 'en')
    const fr = formatRelativeTime(date, 'fr')
    expect(en).not.toBe(fr)
  })
})

describe(formatAbsoluteDateTime, () => {
  it('returns a formatted date-time string', () => {
    const date = new Date('2026-05-13T15:30:00Z')
    const result = formatAbsoluteDateTime(date, 'en-US')
    expectTypeOf(result).toBeString()
    expect(result.length).toBeGreaterThan(0)
  })

  it('caches the formatter per locale across calls', () => {
    const date = new Date('2026-05-13T15:30:00Z')
    const a = formatAbsoluteDateTime(date, 'en-US')
    const b = formatAbsoluteDateTime(date, 'en-US')
    expect(a).toBe(b)
  })

  it('produces different output for different locales', () => {
    const date = new Date('2026-05-13T15:30:00Z')
    const en = formatAbsoluteDateTime(date, 'en-US')
    const de = formatAbsoluteDateTime(date, 'de-DE')
    expect(en).not.toBe(de)
  })
})
