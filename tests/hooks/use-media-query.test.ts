import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from '../../src/hooks/use-media-query'

function setDimensions(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width, writable: true })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
    writable: true
  })
}

function installMatchMedia(matches: (query: string) => boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      addEventListener: () => {},
      addListener: () => {},
      dispatchEvent: () => true,
      matches: matches(query),
      media: query,
      onchange: null,
      removeEventListener: () => {},
      removeListener: () => {}
    }),
    writable: true
  })
}

describe(useMediaQuery, () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('detects desktop when min-width 1024 matches', () => {
    setDimensions(1440, 900)
    installMatchMedia((q) => q.includes('1024'))
    const { result } = renderHook(() => useMediaQuery())
    expect(result.current.device).toBe('desktop')
    expect(result.current.isDesktop).toBeTruthy()
    expect(result.current.width).toBe(1440)
    expect(result.current.height).toBe(900)
  })

  it('detects tablet when only min-width 640 matches', () => {
    setDimensions(768, 1024)
    installMatchMedia((q) => q.includes('640'))
    const { result } = renderHook(() => useMediaQuery())
    expect(result.current.device).toBe('tablet')
    expect(result.current.isTablet).toBeTruthy()
  })

  it('falls back to mobile when no min-width query matches', () => {
    setDimensions(400, 700)
    installMatchMedia(() => false)
    const { result } = renderHook(() => useMediaQuery())
    expect(result.current.device).toBe('mobile')
    expect(result.current.isMobile).toBeTruthy()
  })

  it('updates dimensions on window resize', () => {
    setDimensions(1440, 900)
    installMatchMedia((q) => q.includes('1024'))
    const { result } = renderHook(() => useMediaQuery())
    act(() => {
      setDimensions(400, 600)
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current.width).toBe(400)
    expect(result.current.height).toBe(600)
  })
})
