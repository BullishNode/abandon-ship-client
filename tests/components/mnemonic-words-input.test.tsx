import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { MnemonicWordsInput } from '../../src/components/mnemonic-words-input'
import { createEmptyMnemonicWords } from '../../src/utils/mnemonic'
import { renderWithProviders } from '../utils/render'

let latestWords: string[] = []

function Harness() {
  const [words, setWords] = useState<string[]>(createEmptyMnemonicWords)
  latestWords = words
  return <MnemonicWordsInput onWordsChange={setWords} words={words} />
}

function wordInputs() {
  // cmdk renders each seed input as a combobox, not a plain textbox.
  return screen.getAllByRole('combobox')
}

describe(MnemonicWordsInput, () => {
  it('renders twelve word inputs', () => {
    renderWithProviders(<Harness />)

    expect(wordInputs()).toHaveLength(12)
  })

  it('collects typed wordlist words at their positions', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.type(wordInputs()[0], 'abandon')
    await user.type(wordInputs()[1], 'ability')

    expect(latestWords[0]).toBe('abandon')
    expect(latestWords[1]).toBe('ability')
  })

  it('splits a pasted phrase across the inputs', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    const phrase = `${'abandon '.repeat(11)}about`

    await user.click(wordInputs()[0])
    await user.paste(phrase)

    expect(latestWords).toStrictEqual([...Array.from({ length: 11 }, () => 'abandon'), 'about'])
  })

  it('splits a pasted numbered phrase and ignores separators', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.click(wordInputs()[0])
    await user.paste('1. Abandon\n2. ABILITY')

    expect(latestWords[0]).toBe('abandon')
    expect(latestWords[1]).toBe('ability')
  })

  it('clears slots for pasted words outside the wordlist', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.click(wordInputs()[0])
    await user.paste('abandon notaword ability')

    expect(latestWords[0]).toBe('abandon')
    expect(latestWords[1]).toBe('')
    expect(latestWords[2]).toBe('ability')
  })

  it('pastes starting at the focused input without overflowing past the last slot', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.click(wordInputs()[10])
    await user.paste('abandon ability able about')

    expect(latestWords[10]).toBe('abandon')
    expect(latestWords[11]).toBe('ability')
    expect(latestWords).toHaveLength(12)
  })
})
