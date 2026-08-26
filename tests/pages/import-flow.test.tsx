import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __setRuntimeConfigForTests } from '../../src/config/runtime'
import type { ChainSource } from '../../src/types/domain/chain-source'
import { renderWithProviders } from '../utils/render'

const VALID_PHRASE = `${'abandon '.repeat(11)}about`.split(' ')
const INVALID_CHECKSUM_PHRASE = Array.from({ length: 12 }, () => 'abandon')
const PLACEHOLDER = "Byte's wallet"
const ESPLORA: ChainSource = { esplora: { url: 'http://localhost:18443' } }
const BITCOIND: ChainSource = {
  bitcoind: { bitcoind: '127.0.0.1:38332', bitcoindAuth: { cookie: { cookie: '/data/.cookie' } } }
}

const { default: ImportWalletPage } = await import('../../src/pages/import')
const { walletApi } = await import('../../src/lib/barkd-client')
const { useWalletStore } = await import('../../src/stores/wallet')

const createWalletSpy = vi.spyOn(walletApi, 'createWallet')

function setChainSource(chainSource: ChainSource) {
  __setRuntimeConfigForTests({
    arkServer: 'http://localhost:3535',
    chainSource,
    network: 'signet',
    walletDataPath: '/data/.bark/'
  })
}

function continueButton() {
  return screen.getByRole('button', { name: 'Continue' })
}

async function typePhrase(user: ReturnType<typeof userEvent.setup>, words: string[]) {
  // cmdk renders each seed input as a combobox, not a plain textbox.
  const inputs = screen.getAllByRole('combobox')
  for (const [index, word] of words.entries()) {
    await user.type(inputs[index], word)
  }
}

async function goToMnemonicStep(user: ReturnType<typeof userEvent.setup>) {
  renderWithProviders(<ImportWalletPage />)
  await user.type(screen.getByPlaceholderText(PLACEHOLDER), 'my wallet')
  await waitFor(() => expect(continueButton()).toBeEnabled())
  await user.click(continueButton())
}

async function goToServerStep(user: ReturnType<typeof userEvent.setup>) {
  await goToMnemonicStep(user)
  await typePhrase(user, VALID_PHRASE)
  await waitFor(() => expect(continueButton()).toBeEnabled())
  await user.click(continueButton())
  await screen.findByDisplayValue('http://localhost:3535')
}

describe('import wallet flow', () => {
  beforeEach(() => {
    createWalletSpy.mockReset()
    createWalletSpy.mockResolvedValue({ fingerprint: 'f00dbabe' })
    useWalletStore.setState({ wallet: null })
    setChainSource(ESPLORA)
  })

  afterEach(() => {
    setChainSource(ESPLORA)
  })

  it('keeps Continue disabled until all twelve words are filled', async () => {
    const user = userEvent.setup({ delay: null })
    await goToMnemonicStep(user)

    expect(continueButton()).toBeDisabled()
    await typePhrase(user, VALID_PHRASE.slice(0, 11))
    expect(continueButton()).toBeDisabled()
  })

  it('rejects a complete phrase with a bad checksum', async () => {
    const user = userEvent.setup({ delay: null })
    await goToMnemonicStep(user)

    await typePhrase(user, INVALID_CHECKSUM_PHRASE)

    await expect(
      screen.findByText('Invalid seed phrase. Check that all words are correct and in order.')
    ).resolves.toBeInTheDocument()
    expect(continueButton()).toBeDisabled()
  })

  it('skips the password step in barkd builds', async () => {
    const user = userEvent.setup({ delay: null })
    await goToServerStep(user)

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('imports with a blank birthday height under an esplora chain source', async () => {
    const user = userEvent.setup({ delay: null })
    await goToServerStep(user)

    expect(screen.getByLabelText('Birthday height (optional)')).toHaveValue('')
    await user.click(continueButton())

    await waitFor(() =>
      expect(createWalletSpy).toHaveBeenCalledWith({
        birthdayHeight: undefined,
        mnemonic: VALID_PHRASE.join(' '),
        restore: true
      })
    )
    await waitFor(() => expect(useWalletStore.getState().wallet?.name).toBe('my wallet'))
  })

  it('requires the birthday height under a bitcoind chain source', async () => {
    setChainSource(BITCOIND)
    const user = userEvent.setup({ delay: null })
    await goToServerStep(user)

    await user.click(continueButton())

    await expect(
      screen.findByText('Enter a whole block height greater than 0.')
    ).resolves.toBeInTheDocument()
    expect(createWalletSpy).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Birthday height'), '850000')
    await user.click(continueButton())

    await waitFor(() =>
      expect(createWalletSpy).toHaveBeenCalledWith({
        birthdayHeight: 850_000,
        mnemonic: VALID_PHRASE.join(' '),
        restore: true
      })
    )
  })
})
