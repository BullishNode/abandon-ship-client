import { useState } from 'react'

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = useState(false)

  async function copy(text: string) {
    if (navigator?.clipboard === undefined) {
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => {
        setIsCopied(false)
      }, 2000)
    } catch {
      setIsCopied(false)
    }
  }

  return {
    copy,
    isCopied
  }
}
