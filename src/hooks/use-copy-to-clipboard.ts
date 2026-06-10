import { useState } from 'react'
import { copyText } from '@/utils/clipboard'

const COPIED_RESET_DELAY_MS = 2000

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false)

  async function copy(text: string) {
    const succeeded = await copyText(text)
    setIsCopied(succeeded)
    if (succeeded) {
      setTimeout(() => {
        setIsCopied(false)
      }, COPIED_RESET_DELAY_MS)
    }
  }

  return {
    copy,
    isCopied
  }
}
