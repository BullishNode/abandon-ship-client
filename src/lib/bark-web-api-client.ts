async function apiFetch(path: string): Promise<Response> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin' })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message.length > 0 ? message : `Request failed: ${response.status}`)
  }
  return response
}

export async function downloadWalletBackup(): Promise<{ blob: Blob; filename: string }> {
  const response = await apiFetch('/backup')
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filenameMatch = /filename="([^"]+)"/u.exec(disposition)
  const filename = filenameMatch?.[1] ?? 'bark-wallet-backup.zip'
  const blob = await response.blob()
  return { blob, filename }
}
