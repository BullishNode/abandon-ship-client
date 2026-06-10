import { afterEach, describe, expect, it, vi } from 'vitest'
import { canReadClipboard, copyText } from './clipboard'

function stubClipboard(clipboard?: Partial<Clipboard>) {
  vi.stubGlobal('navigator', { clipboard })
}

function stubExecCommand(result: boolean) {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: () => !result,
    writable: true
  })
  return vi.spyOn(document, 'execCommand').mockReturnValue(result)
}

describe(copyText, () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue()
    stubClipboard({ writeText })

    await expect(copyText('addr')).resolves.toBeTruthy()
    expect(writeText).toHaveBeenCalledWith('addr')
  })

  it('falls back to execCommand when clipboard API is missing', async () => {
    stubClipboard()
    const execCommand = stubExecCommand(true)

    await expect(copyText('addr')).resolves.toBeTruthy()
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('falls back to execCommand when clipboard write rejects', async () => {
    const writeText = vi
      .fn<(value: string) => Promise<void>>()
      .mockRejectedValue(new Error('denied'))
    stubClipboard({ writeText })
    const execCommand = stubExecCommand(true)

    await expect(copyText('addr')).resolves.toBeTruthy()
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('returns false when both clipboard API and fallback fail', async () => {
    stubClipboard()
    const execCommand = stubExecCommand(false)

    await expect(copyText('addr')).resolves.toBeFalsy()
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('cleans up the temporary textarea after fallback copy', async () => {
    stubClipboard()
    stubExecCommand(true)

    await copyText('addr')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('renders the fallback textarea next to the focused element and restores focus', async () => {
    stubClipboard()
    const wrapper = document.createElement('div')
    const button = document.createElement('button')
    wrapper.append(button)
    document.body.append(wrapper)
    button.focus()
    let textareaParent: HTMLElement | null = null
    stubExecCommand(true).mockImplementation(() => {
      textareaParent = document.querySelector('textarea')?.parentElement ?? null
      return true
    })

    await expect(copyText('addr')).resolves.toBeTruthy()
    expect(textareaParent).toBe(wrapper)
    expect(document.activeElement).toBe(button)
    wrapper.remove()
  })
})

describe(canReadClipboard, () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when readText is available', () => {
    stubClipboard({ readText: vi.fn<() => Promise<string>>().mockResolvedValue('') })
    expect(canReadClipboard()).toBeTruthy()
  })

  it('returns false when clipboard API is missing', () => {
    stubClipboard()
    expect(canReadClipboard()).toBeFalsy()
  })
})
