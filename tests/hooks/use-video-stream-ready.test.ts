import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useVideoStreamReady } from '../../src/hooks/use-video-stream-ready'

function makeContainer(video?: { readyState: number }): HTMLDivElement {
  const container = document.createElement('div')
  if (video !== undefined) {
    const element = document.createElement('video')
    Object.defineProperty(element, 'readyState', { value: video.readyState })
    container.append(element)
  }
  return container
}

describe(useVideoStreamReady, () => {
  it('starts not ready and stays not ready without a video element', () => {
    const { result } = renderHook(() => useVideoStreamReady())
    expect(result.current.ready).toBeFalsy()
    act(() => {
      result.current.containerRef(makeContainer())
    })
    expect(result.current.ready).toBeFalsy()
  })

  it('is ready immediately when the video already has data', () => {
    const { result } = renderHook(() => useVideoStreamReady())
    act(() => {
      result.current.containerRef(makeContainer({ readyState: HTMLMediaElement.HAVE_CURRENT_DATA }))
    })
    expect(result.current.ready).toBeTruthy()
  })

  it('becomes ready when the video starts playing', () => {
    const { result } = renderHook(() => useVideoStreamReady())
    const container = makeContainer({ readyState: HTMLMediaElement.HAVE_NOTHING })
    act(() => {
      result.current.containerRef(container)
    })
    expect(result.current.ready).toBeFalsy()
    act(() => {
      container.querySelector('video')?.dispatchEvent(new Event('playing'))
    })
    expect(result.current.ready).toBeTruthy()
  })

  it('stops listening after cleanup', () => {
    const { result } = renderHook(() => useVideoStreamReady())
    const container = makeContainer({ readyState: HTMLMediaElement.HAVE_NOTHING })
    let cleanup: (() => void) | undefined
    act(() => {
      cleanup = result.current.containerRef(container)
    })
    act(() => {
      cleanup?.()
      container.querySelector('video')?.dispatchEvent(new Event('loadeddata'))
    })
    expect(result.current.ready).toBeFalsy()
  })
})
