import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../utils/render'

const VALID_PHRASE = `${'abandon '.repeat(11)}about`.split(' ')
const PLACEHOLDER = "Byte's wallet"

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

const { default: ImportWalletPage } = await import('../../src/pages/import')
const { walletApi } = await import('../../src/lib/barkd-client')
const { useWalletStore } = await import('../../src/stores/wallet')

const createWalletSpy = vi.spyOn(walletApi, 'createWallet')

function continueButton() {
  return screen.getByRole('button', { name: 'Continue' })
}

async function goToMnemonicStep(user: ReturnType<typeof userEvent.setup>) {
  renderWithProviders(<ImportWalletPage />)
  await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'my wallet')
  await waitFor(() => expect(continueButton()).toBeEnabled())
  await user.click(continueButton())
}

async function typePhrase(user: ReturnType<typeof userEvent.setup>) {
  const inputs = screen.getAllByRole('combobox')
  for (const [index, word] of VALID_PHRASE.entries()) {
    await user.type(inputs[index], word)
  }
}

describe('import wallet flow (WASM)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createWalletSpy.mockResolvedValue({ fingerprint: 'f00dbabe' })
    isSilentUnlockSupported.mockResolvedValue(true)
    persistOnboardingPassword.mockResolvedValue()
    useWalletStore.setState({ wallet: null })
  })

  it('warns that recovery relies on the Ark server', async () => {
    const user = userEvent.setup()
    await goToMnemonicStep(user)

    expect(
      screen.getByText(/Restoring from your seed phrase relies on the Ark server/iu)
    ).toBeInTheDocument()
  })

  it('imports without a birthday height field and with the chosen password', async () => {
    const user = userEvent.setup()
    await goToMnemonicStep(user)
    await typePhrase(user)
    await waitFor(() => expect(continueButton()).toBeEnabled())
    await user.click(continueButton())

    await screen.findByLabelText('Password')
    await user.type(screen.getByLabelText('Password'), 'correct horse')
    await user.type(screen.getByLabelText('Confirm password'), 'correct horse')
    await user.click(continueButton())

    await screen.findByDisplayValue('http://localhost:3535')
    expect(screen.queryByLabelText('Birthday height (optional)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Birthday height')).not.toBeInTheDocument()
    await user.click(continueButton())

    await waitFor(() =>
      expect(createWalletSpy).toHaveBeenCalledWith({
        birthdayHeight: undefined,
        mnemonic: VALID_PHRASE.join(' '),
        restore: true
      })
    )
    await waitFor(() => expect(persistOnboardingPassword).toHaveBeenCalledWith('correct horse'))
  })
})
