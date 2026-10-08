import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../utils/render'

const TEST_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident'
const TEST_WORDS = TEST_MNEMONIC.split(' ')
const PLACEHOLDER = "Byte's wallet"

vi.mock(import('@scure/bip39'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, generateMnemonic: () => TEST_MNEMONIC }
})

const { default: CreateWalletPage } = await import('../../src/pages/create')
const { walletApi } = await import('../../src/lib/barkd-client')
const { useWalletStore } = await import('../../src/stores/wallet')

const createWalletSpy = vi.spyOn(walletApi, 'createWallet')

function continueButton() {
  return screen.getByRole('button', { name: 'Continue' })
}

async function fillNameAndContinue(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'my wallet')
  await waitFor(() => expect(continueButton()).toBeEnabled())
  await user.click(continueButton())
}

describe('create wallet flow', () => {
  beforeEach(() => {
    createWalletSpy.mockReset()
    createWalletSpy.mockResolvedValue({ fingerprint: 'f00dbabe' })
    useWalletStore.setState({ wallet: null })
  })

  it('blocks the first step until the name has a letter or number', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateWalletPage />)

    expect(continueButton()).toBeDisabled()
    await user.type(screen.getByPlaceholderText(PLACEHOLDER), '***')
    await waitFor(() => expect(continueButton()).toBeDisabled())
    await user.type(screen.getByPlaceholderText(PLACEHOLDER), '1')
    await waitFor(() => expect(continueButton()).toBeEnabled())
  })

  it('skips the password step in barkd builds', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateWalletPage />)

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    await fillNameAndContinue(user)
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('shows every word of the generated seed phrase', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateWalletPage />)

    await fillNameAndContinue(user)

    for (const word of TEST_WORDS) {
      expect(screen.getByText(word)).toBeInTheDocument()
    }
  })

  it('keeps Continue disabled while the confirmation order is wrong', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateWalletPage />)

    await fillNameAndContinue(user)
    await user.click(continueButton())
    await user.click(screen.getByRole('button', { name: TEST_WORDS[5] }))

    expect(continueButton()).toBeDisabled()
  })

  it('enables Continue once every word is confirmed in order', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateWalletPage />)

    await fillNameAndContinue(user)
    await user.click(continueButton())
    for (const word of TEST_WORDS) {
      await user.click(screen.getByRole('button', { name: word }))
    }

    await waitFor(() => expect(continueButton()).toBeEnabled())
  })

  it('creates the wallet after skipping the confirmation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CreateWalletPage />)

    await fillNameAndContinue(user)
    await user.click(continueButton())
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
    await waitFor(() => expect(useWalletStore.getState().wallet?.name).toBe('my wallet'))
  })
})
