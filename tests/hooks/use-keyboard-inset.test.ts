import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardInset } from '../../src/hooks/use-keyboard-inset'

type Listener = () => void

interface FakeViewport {
  height: number
  offsetTop: number
  scale: number
  listeners: Listener[]
  addEventListener: (event: string, handler: Listener) => void
  removeEventListener: (event: string, handler: Listener) => void
}

function makeViewport(height: number, offsetTop: number): FakeViewport {
  const listeners: Listener[] = []
  return {
    addEventListener: (_event, handler) => {
      listeners.push(handler)
    },
    height,
    listeners,
    offsetTop,
    removeEventListener: (_event, handler) => {
      const index = listeners.indexOf(handler)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    },
    scale: 1
  }
}

describe(useKeyboardInset, () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports zero inset when the visual viewport fills the window', () => {
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal('visualViewport', makeViewport(800, 0))
    const { result } = renderHook(() => useKeyboardInset())
    expect(result.current.inset).toBe(0)
  })

  it('reports the keyboard height when the viewport shrinks', () => {
    vi.stubGlobal('innerHeight', 800)
    const viewport = makeViewport(800, 0)
    vi.stubGlobal('visualViewport', viewport)
    const { result } = renderHook(() => useKeyboardInset())
    viewport.height = 500
    act(() => {
      for (const handler of viewport.listeners) {
        handler()
      }
    })
    expect(result.current.inset).toBe(300)
    expect(result.current.viewportHeight).toBe(500)
  })

  it('subtracts the viewport pan offset from the inset', () => {
    vi.stubGlobal('innerHeight', 800)
    const viewport = makeViewport(800, 0)
    vi.stubGlobal('visualViewport', viewport)
    const { result } = renderHook(() => useKeyboardInset())
    viewport.height = 500
    viewport.offsetTop = 100
    act(() => {
      for (const handler of viewport.listeners) {
        handler()
      }
    })
    expect(result.current.inset).toBe(200)
  })

  it('never reports a negative inset', () => {
    vi.stubGlobal('innerHeight', 800)
    const viewport = makeViewport(800, 0)
    vi.stubGlobal('visualViewport', viewport)
    const { result } = renderHook(() => useKeyboardInset())
    viewport.offsetTop = 100
    act(() => {
      for (const handler of viewport.listeners) {
        handler()
      }
    })
    expect(result.current.inset).toBe(0)
  })

  it('ignores viewport shrink caused by pinch zoom', () => {
    vi.stubGlobal('innerHeight', 800)
    const viewport = makeViewport(800, 0)
    vi.stubGlobal('visualViewport', viewport)
    const { result } = renderHook(() => useKeyboardInset())
    viewport.height = 400
    viewport.scale = 2
    act(() => {
      for (const handler of viewport.listeners) {
        handler()
      }
    })
    expect(result.current.inset).toBe(0)
  })

  it('removes viewport listeners on unmount', () => {
    vi.stubGlobal('innerHeight', 800)
    const viewport = makeViewport(800, 0)
    vi.stubGlobal('visualViewport', viewport)
    const { unmount } = renderHook(() => useKeyboardInset())
    expect(viewport.listeners.length).toBeGreaterThan(0)
    unmount()
    expect(viewport.listeners).toHaveLength(0)
  })
})
