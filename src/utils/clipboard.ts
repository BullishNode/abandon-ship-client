function getFallbackContainer(activeElement: Element | null): HTMLElement {
  // Render inside the focused element's parent so focus traps (Radix Dialog,
  // vaul Drawer) don't pull focus back and clear the selection.
  if (activeElement instanceof HTMLElement && activeElement.parentElement !== null) {
    return activeElement.parentElement
  }
  return document.body
}

function copyTextFallback(text: string): boolean {
  const previouslyFocused = document.activeElement
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.opacity = '0'
  getFallbackContainer(previouslyFocused).append(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  let succeeded = false
  try {
    // oxlint-disable-next-line typescript/no-deprecated -- intentional fallback for insecure (HTTP) contexts where navigator.clipboard is unavailable
    succeeded = document.execCommand('copy')
  } catch {
    succeeded = false
  }

  textarea.remove()
  if (previouslyFocused instanceof HTMLElement) {
    previouslyFocused.focus()
  }
  return succeeded
}

export function canReadClipboard(): boolean {
  return typeof navigator?.clipboard?.readText === 'function'
}

export async function copyText(text: string): Promise<boolean> {
  if (navigator?.clipboard === undefined) {
    return copyTextFallback(text)
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return copyTextFallback(text)
  }
}
