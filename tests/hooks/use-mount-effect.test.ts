import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMountEffect } from '../../src/hooks/use-mount-effect'

describe(useMountEffect, () => {
  it('runs the effect exactly once', () => {
    const effect = vi.fn<() => void>()
    const { rerender } = renderHook(() => {
      useMountEffect(effect)
    })
    expect(effect).toHaveBeenCalledOnce()
    rerender()
    rerender()
    expect(effect).toHaveBeenCalledOnce()
  })

  it('runs the cleanup on unmount', () => {
    const cleanup = vi.fn<() => void>()
    const { unmount } = renderHook(() => {
      useMountEffect(() => cleanup)
    })
    expect(cleanup).not.toHaveBeenCalled()
    unmount()
    expect(cleanup).toHaveBeenCalledOnce()
  })
})
