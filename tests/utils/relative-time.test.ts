import { afterEach, beforeEach, describe, expect, it, vi, expectTypeOf } from 'vitest'
import { formatRelativeTime } from '../../src/utils/relative-time'

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
})
