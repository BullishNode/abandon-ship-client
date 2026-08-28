import { useSyncExternalStore } from 'react'

interface KeyboardInset {
  inset: number
  viewportHeight: number
}

const noInset: KeyboardInset = { inset: 0, viewportHeight: 0 }

let cached = noInset

function noop(): void {
  // no visual viewport to observe
}

const ZOOMED_IN_SCALE_THRESHOLD = 1.01

function computeInset(): KeyboardInset {
  const viewport = window.visualViewport
  if (viewport === null || viewport.scale > ZOOMED_IN_SCALE_THRESHOLD) {
    return noInset
  }
  const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
  return { inset, viewportHeight: Math.round(viewport.height) }
}

function getSnapshot(): KeyboardInset {
  const next = computeInset()
  if (next.inset !== cached.inset || next.viewportHeight !== cached.viewportHeight) {
    cached = next
  }
  return cached
}

function subscribe(listener: () => void): () => void {
  const viewport = window.visualViewport
  if (viewport === null) {
    return noop
  }
  viewport.addEventListener('resize', listener)
  viewport.addEventListener('scroll', listener)
  return () => {
    viewport.removeEventListener('resize', listener)
    viewport.removeEventListener('scroll', listener)
  }
}

export function useKeyboardInset(): KeyboardInset {
  return useSyncExternalStore(subscribe, getSnapshot, () => noInset)
}
