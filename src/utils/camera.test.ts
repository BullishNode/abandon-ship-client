import { afterEach, describe, expect, it, vi } from 'vitest'
import { canUseCamera } from './camera'

describe(canUseCamera, () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when getUserMedia is available', () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn<() => void>() } })
    expect(canUseCamera()).toBeTruthy()
  })

  it('returns false when mediaDevices is missing', () => {
    vi.stubGlobal('navigator', {})
    expect(canUseCamera()).toBeFalsy()
  })
})
