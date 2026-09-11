import type { PaymentsResult } from '@branta-ops/branta/v2'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { brantaClient } from '../../../src/config/branta'
import { useBrantaVerification } from '../../../src/hooks/branta/use-branta-verification'
import { useSettingsStore } from '../../../src/stores/settings'
import type { BrantaMode } from '../../../src/types/branta'

const QR_CODE = 'lnbc1testinvoice'
const EMPTY_RESULT = { payments: [], verifyUrl: 'https://branta.pro/verify' }

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function renderVerification(qrCode: string | undefined) {
  return renderHook(() => useBrantaVerification(qrCode), { wrapper: createWrapper() })
}

function setBrantaMode(mode: BrantaMode) {
  useSettingsStore.setState({ brantaMode: mode })
}

describe(useBrantaVerification, () => {
  beforeEach(() => {
    vi.spyOn(brantaClient, 'getPaymentsByQrCode').mockResolvedValue(EMPTY_RESULT)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setBrantaMode('strict')
  })

  it('looks up with strict privacy by default', async () => {
    const { result } = renderVerification(QR_CODE)

    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })
    expect(brantaClient.getPaymentsByQrCode).toHaveBeenCalledWith(
      QR_CODE,
      expect.objectContaining({ privacy: 'strict' }),
      expect.anything()
    )
  })

  it('looks up with loose privacy when selected', async () => {
    setBrantaMode('loose')
    const { result } = renderVerification(QR_CODE)

    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })
    expect(brantaClient.getPaymentsByQrCode).toHaveBeenCalledWith(
      QR_CODE,
      expect.objectContaining({ privacy: 'loose' }),
      expect.anything()
    )
  })

  it('never contacts branta when turned off', () => {
    setBrantaMode('off')
    const { result } = renderVerification(QR_CODE)

    expect(result.current.fetchStatus).toBe('idle')
    expect(brantaClient.getPaymentsByQrCode).not.toHaveBeenCalled()
  })

  it('does not fetch without a qr code', () => {
    const { result } = renderVerification('')

    expect(result.current.fetchStatus).toBe('idle')
    expect(brantaClient.getPaymentsByQrCode).not.toHaveBeenCalled()
  })

  it('refetches with the new privacy mode when the setting changes while mounted', async () => {
    const { result } = renderVerification(QR_CODE)

    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })
    expect(brantaClient.getPaymentsByQrCode).toHaveBeenLastCalledWith(
      QR_CODE,
      expect.objectContaining({ privacy: 'strict' }),
      expect.anything()
    )

    act(() => {
      setBrantaMode('loose')
    })

    await waitFor(() => {
      expect(brantaClient.getPaymentsByQrCode).toHaveBeenLastCalledWith(
        QR_CODE,
        expect.objectContaining({ privacy: 'loose' }),
        expect.anything()
      )
    })
  })

  it('stops contacting branta when turned off while mounted', async () => {
    const { result } = renderVerification(QR_CODE)

    await waitFor(() => {
      expect(result.current.isSuccess).toBeTruthy()
    })

    act(() => {
      setBrantaMode('off')
    })

    await waitFor(() => {
      expect(result.current.data).toBeUndefined()
    })
    expect(result.current.fetchStatus).toBe('idle')
    expect(brantaClient.getPaymentsByQrCode).toHaveBeenCalledOnce()
  })

  it('aborts an in-flight lookup when the mode changes', async () => {
    const signals: (AbortSignal | undefined)[] = []
    vi.mocked(brantaClient.getPaymentsByQrCode).mockImplementation(
      async (_qrCode, _options, signal) => {
        signals.push(signal)
        // never settles, so the lookup stays in flight until it is aborted
        return await Promise.race<PaymentsResult>([])
      }
    )
    renderVerification(QR_CODE)

    await waitFor(() => {
      expect(signals).toHaveLength(1)
    })

    act(() => {
      setBrantaMode('off')
    })

    await waitFor(() => {
      expect(signals[0]?.aborted).toBeTruthy()
    })
  })
})
