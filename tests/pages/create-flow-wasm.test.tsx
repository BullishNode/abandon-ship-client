import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../utils/render'

const TEST_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident'
const PLACEHOLDER = "Byte's wallet"

vi.mock(import('@scure/bip39'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, generateMnemonic: () => TEST_MNEMONIC }
})

// vitest compiles with the barkd `__BACKEND__` literal, so the WASM branch is
// reached by mocking the feature flags rather than the global.
vi.mock(import('@/lib/backend-features'), () => ({
  supportsBirthdayHeight: false,
  supportsWalletPassword: true,
  usesServerAssistedRecovery: true
}))

const isSilentUnlockSupported = vi.fn<() => Promise<boolean>>()
const persistOnboardingPassword = vi.fn<(password: string) => Promise<void>>()

vi.mock(import('@/lib/onboarding-password'), () => ({
  isSilentUnlockSupported,
  persistOnboardingPassword
}))

const { default: CreateWalletPage } = await import('../../src/pages/create')
const { walletApi } = await import('../../src/lib/barkd-client')
const { useWalletStore } = await import('../../src/stores/wallet')

const createWalletSpy = vi.spyOn(walletApi, 'createWallet')

function continueButton() {
  return screen.getByRole('button', { name: 'Continue' })
}

async function goToPasswordStep(user: ReturnType<typeof userEvent.setup>) {
  renderWithProviders(<CreateWalletPage />)
  await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'my wallet')
  await waitFor(() => expect(continueButton()).toBeEnabled())
  await user.click(continueButton())
  await user.click(continueButton())
  await user.click(screen.getByRole('button', { name: 'Skip' }))
  await screen.findByLabelText('Password')
}

describe('create wallet flow (WASM)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createWalletSpy.mockResolvedValue({ fingerprint: 'f00dbabe' })
    isSilentUnlockSupported.mockResolvedValue(true)
    persistOnboardingPassword.mockResolvedValue()
    useWalletStore.setState({ wallet: null })
  })

  it('adds the password step to the flow', async () => {
    const user = userEvent.setup()
    await goToPasswordStep(user)

    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('blocks Continue until both password fields match', async () => {
    const user = userEvent.setup()
    await goToPasswordStep(user)

    expect(continueButton()).toBeDisabled()
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.type(screen.getByLabelText('Confirm password'), 'correct hors')
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(continueButton()).toBeDisabled()
    await user.type(screen.getByLabelText('Confirm password'), 'e')
    await waitFor(() => expect(continueButton()).toBeEnabled())
  })

  it('creates the wallet with the chosen password', async () => {
    const user = userEvent.setup()
    await goToPasswordStep(user)

    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.type(screen.getByLabelText('Confirm password'), 'correct horse')
    await user.click(continueButton())
    await screen.findByDisplayValue('http://localhost:3535')
    await user.click(continueButton())

    await waitFor(() =>
      expect(createWalletSpy).toHaveBeenCalledWith({
        birthdayHeight: undefined,
        mnemonic: TEST_MNEMONIC,
        restore: false
      })
    )
    await waitFor(() => expect(persistOnboardingPassword).toHaveBeenCalledWith('correct horse'))
  })

  it('drops the password when the step is skipped', async () => {
    const user = userEvent.setup()
    await goToPasswordStep(user)

    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.type(screen.getByLabelText('Confirm password'), 'correct horse')
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await screen.findByDisplayValue('http://localhost:3535')
    await user.click(continueButton())

    await waitFor(() =>
      expect(createWalletSpy).toHaveBeenCalledWith({
        birthdayHeight: undefined,
        mnemonic: TEST_MNEMONIC,
        restore: false
      })
    )
    expect(persistOnboardingPassword).not.toHaveBeenCalled()
  })

  it('warns when this browser cannot unlock a passwordless wallet', async () => {
    isSilentUnlockSupported.mockResolvedValue(false)
    const user = userEvent.setup()
    await goToPasswordStep(user)

    await expect(
      screen.findByText(/you will have to type your seed phrase every time/iu)
    ).resolves.toBeInTheDocument()
  })
})
