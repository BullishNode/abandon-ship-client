import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = () => void

interface FakeStatus {
  state: PermissionState
  listeners: Listener[]
  addEventListener: (event: 'change', handler: Listener) => void
}

function makeStatus(state: PermissionState): FakeStatus {
  const listeners: Listener[] = []
  return {
    addEventListener: (_event, handler) => {
      listeners.push(handler)
    },
    listeners,
    state
  }
}

describe('useCameraReady', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when camera permission is granted', async () => {
    const status = makeStatus('granted')
    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn<() => Promise<FakeStatus>>().mockResolvedValue(status) }
    })
    const { useCameraReady } = await import('../../src/hooks/use-camera-ready')
    const { result } = renderHook(() => useCameraReady())
    await waitFor(() => {
      expect(result.current).toBeTruthy()
    })
  })

  it('returns false when permission denied and registers a change listener', async () => {
    const status = makeStatus('denied')
    const query = vi.fn<() => Promise<FakeStatus>>().mockResolvedValue(status)
    vi.stubGlobal('navigator', { permissions: { query } })
    const { useCameraReady } = await import('../../src/hooks/use-camera-ready')
    const { result } = renderHook(() => useCameraReady())
    await waitFor(() => {
      expect(query).toHaveBeenCalledOnce()
      expect(status.listeners).toHaveLength(1)
    })
    expect(result.current).toBeFalsy()
  })

  it('flips to true when the permission status later changes to granted', async () => {
    const status = makeStatus('denied')
    const query = vi.fn<() => Promise<FakeStatus>>().mockResolvedValue(status)
    vi.stubGlobal('navigator', { permissions: { query } })
    const { useCameraReady } = await import('../../src/hooks/use-camera-ready')
    const { result } = renderHook(() => useCameraReady())
    await waitFor(() => {
      expect(status.listeners).toHaveLength(1)
    })
    status.state = 'granted'
    for (const handler of status.listeners) {
      handler()
    }
    await waitFor(() => {
      expect(result.current).toBeTruthy()
    })
  })

  it('falls back to true when permissions.query throws', async () => {
    vi.stubGlobal('navigator', {
      permissions: { query: vi.fn<() => Promise<unknown>>().mockRejectedValue(new Error('x')) }
    })
    const { useCameraReady } = await import('../../src/hooks/use-camera-ready')
    const { result } = renderHook(() => useCameraReady())
    await waitFor(() => {
      expect(result.current).toBeTruthy()
    })
  })
})
