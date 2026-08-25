import { renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(import('@/lib/onboarding-password'), () => ({
  isSilentUnlockSupported: vi.fn<() => Promise<boolean>>(),
  persistOnboardingPassword: vi.fn<(password: string) => Promise<void>>()
}))

const { useOnboardingWallet } = await import('../../src/hooks/use-onboarding-wallet')
const { persistOnboardingPassword } = await import('../../src/lib/onboarding-password')
const { walletApi } = await import('../../src/lib/barkd-client')
const { useWalletStore } = await import('../../src/stores/wallet')
const { TestProviders } = await import('../utils/render')

const createWalletSpy = vi.spyOn(walletApi, 'createWallet')
const toastErrorSpy = vi.spyOn(toast, 'error')
const toastWarningSpy = vi.spyOn(toast, 'warning')

// The hook navigates through the real router, so the route markers below are how
// the test observes that it left onboarding.
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <TestProviders>
      {children}
      <Routes>
        <Route element={<div>ONBOARDING</div>} path="/" />
        <Route element={<div>DASHBOARD</div>} path="/dashboard" />
      </Routes>
    </TestProviders>
  )
}

function runOnboarding(password: string) {
  const { result } = renderHook(() => useOnboardingWallet(), { wrapper: Wrapper })
  result.current.mutate({ mnemonic: 'twelve words here', name: 'wallet', password })
  return result
}

describe('useOnboardingWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createWalletSpy.mockResolvedValue({ fingerprint: 'f00dbabe' })
    toastErrorSpy.mockReturnValue('toast-id')
    toastWarningSpy.mockReturnValue('toast-id')
    vi.mocked(persistOnboardingPassword).mockResolvedValue()
    useWalletStore.setState({ wallet: null })
  })

  it('creates the wallet and skips the vault when no password was chosen', async () => {
    runOnboarding('')

    await screen.findByText('DASHBOARD')
    expect(createWalletSpy).toHaveBeenCalledOnce()
    expect(persistOnboardingPassword).not.toHaveBeenCalled()
    expect(toastErrorSpy).not.toHaveBeenCalled()
  })

  it('persists the chosen password before leaving onboarding', async () => {
    runOnboarding('correct horse battery')

    await screen.findByText('DASHBOARD')
    expect(persistOnboardingPassword).toHaveBeenCalledWith('correct horse battery')
  })

  it('keeps the created wallet reachable when the password cannot be saved', async () => {
    vi.mocked(persistOnboardingPassword).mockRejectedValue(new Error('no crypto'))

    runOnboarding('correct horse battery')

    await screen.findByText('DASHBOARD')
    expect(toastErrorSpy).toHaveBeenCalledWith(
      'Wallet created, but the password could not be saved. Set one in Settings.'
    )
  })

  it('warns when the restore-time onchain scan failed but still proceeds', async () => {
    createWalletSpy.mockResolvedValue({ fingerprint: 'f00dbabe', scanIncomplete: true })

    runOnboarding('')

    await screen.findByText('DASHBOARD')
    expect(toastWarningSpy).toHaveBeenCalledWith(
      'Could not scan for existing onchain history. Your wallet works, but past onchain transactions may be missing.'
    )
  })

  it('stays on the flow and reports the failure when creation fails', async () => {
    createWalletSpy.mockResolvedValue({ fingerprint: '' })

    runOnboarding('')

    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalledWith('Failed to create wallet'))
    expect(screen.getByText('ONBOARDING')).toBeInTheDocument()
  })
})
