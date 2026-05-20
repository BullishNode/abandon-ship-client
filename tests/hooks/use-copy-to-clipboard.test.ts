import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCopyToClipboard } from '../../src/hooks/use-copy-to-clipboard'

describe(useCopyToClipboard, () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('writes text to clipboard and flips isCopied true then false after 2s', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const { result } = renderHook(() => useCopyToClipboard())
    expect(result.current.isCopied).toBeFalsy()

    await act(async () => {
      await result.current.copy('hello')
    })

    expect(writeText).toHaveBeenCalledWith('hello')
    expect(result.current.isCopied).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(result.current.isCopied).toBeFalsy()
  })

  it('no-ops when navigator.clipboard is undefined', async () => {
    vi.stubGlobal('navigator', {})
    const { result } = renderHook(() => useCopyToClipboard())
    await act(async () => {
      await result.current.copy('x')
    })
    expect(result.current.isCopied).toBeFalsy()
  })

  it('flips isCopied back to false when writeText rejects after a successful copy', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>()
    writeText.mockResolvedValueOnce().mockRejectedValueOnce(new Error('nope'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const { result } = renderHook(() => useCopyToClipboard())
    await act(async () => {
      await result.current.copy('first')
    })
    expect(result.current.isCopied).toBeTruthy()
    await act(async () => {
      await result.current.copy('second')
    })
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(result.current.isCopied).toBeFalsy()
  })
})
