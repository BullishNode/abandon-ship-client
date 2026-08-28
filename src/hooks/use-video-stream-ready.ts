import { useState } from 'react'

type CleanupFn = () => void

export function useVideoStreamReady(): {
  ready: boolean
  containerRef: (node: HTMLElement | null) => CleanupFn | undefined
} {
  const [ready, setReady] = useState(false)

  function containerRef(node: HTMLElement | null): CleanupFn | undefined {
    if (node === null) {
      return undefined
    }
    const video = node.querySelector('video')
    if (video === null) {
      return undefined
    }
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setReady(true)
      return undefined
    }
    function markReady(): void {
      setReady(true)
    }
    video.addEventListener('loadeddata', markReady)
    video.addEventListener('playing', markReady)
    return () => {
      video.removeEventListener('loadeddata', markReady)
      video.removeEventListener('playing', markReady)
    }
  }

  return { containerRef, ready }
}
