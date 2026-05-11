const BASE_URL = import.meta.env.VITE_BARK_WEB_API_URL
const TOKEN = import.meta.env.VITE_BARKD_TOKEN

async function authorizedFetch(path: string): Promise<Response> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message.length > 0 ? message : `Request failed: ${response.status}`)
  }
  return response
}

export async function downloadWalletBackup(): Promise<{ blob: Blob; filename: string }> {
  const response = await authorizedFetch('/api/backup')
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filenameMatch = /filename="([^"]+)"/u.exec(disposition)
  const filename = filenameMatch?.[1] ?? 'bark-wallet-backup.zip'
  const blob = await response.blob()
  return { blob, filename }
}
