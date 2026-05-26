async function apiFetch(path: string): Promise<Response> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin' })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message.length > 0 ? message : `Request failed: ${response.status}`)
  }
  return response
}

function isMnemonicResponse(value: unknown): value is { mnemonic: string } {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if (!('mnemonic' in value)) {
    return false
  }
  return typeof value.mnemonic === 'string'
}

export async function getWalletMnemonic(): Promise<string> {
  const response = await apiFetch('/mnemonic')
  const data: unknown = await response.json()
  if (!isMnemonicResponse(data)) {
    throw new Error('Invalid mnemonic response')
  }
  return data.mnemonic
}
