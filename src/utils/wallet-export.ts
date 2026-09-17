import { config } from '@/config/runtime'
import { authedFetch } from '@/lib/backend/barkd/authed-fetch'
import { downloadBlob } from '@/utils/download'

const EXPORT_ENDPOINT = '/api/export-db'
const FILENAME_PATTERN = /filename="([^"]+)"/u

function fallbackSqliteFilename(): string {
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  return `bark-wallet-${config.network}-${timestamp}.sqlite`
}

async function downloadBarkdExport(): Promise<void> {
  const response = await authedFetch(EXPORT_ENDPOINT)
  if (!response.ok) {
    throw new Error(`Failed to export wallet database: ${response.status}`)
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  const filename = FILENAME_PATTERN.exec(disposition)?.[1] ?? fallbackSqliteFilename()
  downloadBlob(await response.blob(), filename)
}

// The WASM export module is loaded through a build-time-guarded dynamic import
// so the IndexedDB dump code never enters barkd bundles (and vice versa the
// barkd endpoint is never fetched in wasm builds, where no server exists).
async function downloadWasmExport(): Promise<void> {
  const { exportWalletData } = await import('@/lib/backend/wasm/export')
  const { blob, filename } = await exportWalletData()
  downloadBlob(blob, filename)
}

// Settings → "Export wallet data". barkd mode downloads a consistent snapshot
// of the daemon's SQLite database; WASM mode downloads a JSON dump of the
// wallet's IndexedDB databases and localStorage side-stores.
export async function downloadWalletExport(): Promise<void> {
  await (__BACKEND__ === 'wasm' ? downloadWasmExport() : downloadBarkdExport())
}
