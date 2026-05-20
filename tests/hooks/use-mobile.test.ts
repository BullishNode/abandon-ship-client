import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsMobile } from '../../src/hooks/use-mobile'

type ChangeHandler = () => void

interface FakeMql {
  matches: boolean
  media: string
  onchange: null
  handlers: ChangeHandler[]
  removeSpy: ReturnType<typeof vi.fn<(event: string, handler: ChangeHandler) => void>>
  addEventListener: (event: 'change', handler: ChangeHandler) => void
  removeEventListener: (event: string, handler: ChangeHandler) => void
  addListener: () => void
  removeListener: () => void
  dispatchEvent: () => boolean
}

function createMql(): FakeMql {
  const handlers: ChangeHandler[] = []
  const removeSpy = vi.fn<(event: string, handler: ChangeHandler) => void>()
  return {
    addEventListener(event, handler) {
      if (event === 'change') {
        handlers.push(handler)
      }
    },
    addListener() {},
    dispatchEvent() {
      return true
    },
    handlers,
    matches: false,
    media: '',
    onchange: null,
    removeEventListener(event, handler) {
      removeSpy(event, handler)
    },
    removeListener() {},
    removeSpy
  }
}

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width, writable: true })
}

function installMatchMedia(mql: FakeMql) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => mql,
    writable: true
  })
}

describe(useIsMobile, () => {
  let mql: FakeMql

  beforeEach(() => {
    mql = createMql()
    installMatchMedia(mql)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when innerWidth is below the breakpoint', () => {
    setInnerWidth(500)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBeTruthy()
  })

  it('returns false at or above the breakpoint', () => {
    setInnerWidth(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBeFalsy()
  })

  it('responds to mql change events', () => {
    setInnerWidth(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBeFalsy()
    setInnerWidth(500)
    act(() => {
      for (const handler of mql.handlers) {
        handler()
      }
    })
    expect(result.current).toBeTruthy()
  })

  it('removes its listener on unmount', () => {
    setInnerWidth(800)
    const { unmount } = renderHook(() => useIsMobile())
    unmount()
    expect(mql.removeSpy).toHaveBeenCalledOnce()
  })
})
