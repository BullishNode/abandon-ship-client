import { wordlist } from '@scure/bip39/wordlists/english.js'
import { useState } from 'react'
import { SeedLayout } from '@/components/layout/seed-layout'
import { SeedWordAutocomplete } from '@/components/seed-word-autocomplete'
import { createEmptyMnemonicWords, MNEMONIC_WORD_COUNT } from '@/utils/mnemonic'

const wordlistItems = wordlist.map((word) => ({ label: word, value: word }))
const NON_LETTERS = /[^a-z]+/u

function extractPastedWords(clipboardText: string): string[] {
  return clipboardText.toLowerCase().split(NON_LETTERS).filter(Boolean)
}

type WordsUpdate = (currentWords: string[]) => string[]

interface MnemonicWordsInputProps {
  words: string[]
  onWordsChange: (update: WordsUpdate) => void
  className?: string
}

export function MnemonicWordsInput({ words, onWordsChange, className }: MnemonicWordsInputProps) {
  const [searchValues, setSearchValues] = useState(createEmptyMnemonicWords)

  function handleSearchChange(index: number, value: string) {
    setSearchValues((prev) => prev.map((search, i) => (i === index ? value : search)))
  }

  function handleValueChange(index: number, value: string) {
    onWordsChange((currentWords) => currentWords.map((word, i) => (i === index ? value : word)))
  }

  function handlePaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const pastedWords = extractPastedWords(event.clipboardData.getData('text'))
    if (pastedWords.length < 2) {
      return
    }
    event.preventDefault()

    function applyPastedWords<T>(current: T[], toValue: (pastedWord: string) => T): T[] {
      const updated = [...current]
      for (const [offset, pastedWord] of pastedWords.entries()) {
        const target = index + offset
        if (target >= MNEMONIC_WORD_COUNT) {
          break
        }
        updated[target] = toValue(pastedWord)
      }
      return updated
    }

    setSearchValues((prev) => applyPastedWords(prev, (pastedWord) => pastedWord))
    onWordsChange((currentWords) =>
      applyPastedWords(currentWords, (pastedWord) =>
        wordlist.includes(pastedWord) ? pastedWord : ''
      )
    )
  }

  return (
    <SeedLayout className={className}>
      {Array.from({ length: MNEMONIC_WORD_COUNT }, (_, index) => ({
        id: `mnemonic-word-${index}`,
        index
      })).map(({ id, index }) => {
        const selectedValue = words[index] || ''
        const searchValue = searchValues[index]

        return (
          <SeedWordAutocomplete
            iconLeft={<span>{index + 1}</span>}
            items={wordlistItems}
            key={id}
            onPaste={(event) => handlePaste(index, event)}
            onSearchValueChange={(value) => handleSearchChange(index, value)}
            onSelectedValueChange={(value) => handleValueChange(index, value)}
            searchValue={searchValue}
            selectedValue={selectedValue}
          />
        )
      })}
    </SeedLayout>
  )
}
