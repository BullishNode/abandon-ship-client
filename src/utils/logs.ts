import { authedFetch } from '@/lib/backend/barkd/authed-fetch'
import { downloadBlob } from '@/utils/download'

const LOGS_ENDPOINT = '/api/logs'
const LOGS_DOWNLOAD_NAME = 'barkd-debug.log'
const WASM_LOGS_DOWNLOAD_NAME = 'bark-web-diagnostics.log'

export async function downloadDebugLog(): Promise<void> {
  if (__BACKEND__ === 'wasm') {
    const { getDiagnosticsLog } = await import('@/lib/backend/wasm')
    const lines = await getDiagnosticsLog()
    const text = lines.length > 0 ? `${lines.join('\n')}\n` : 'No diagnostics recorded yet.\n'
    downloadBlob(new Blob([text], { type: 'text/plain' }), WASM_LOGS_DOWNLOAD_NAME)
    return
  }
  const response = await authedFetch(LOGS_ENDPOINT)
  if (!response.ok) {
    throw new Error(`Failed to download logs: ${response.status}`)
  }
  const blob = await response.blob()
  downloadBlob(blob, LOGS_DOWNLOAD_NAME)
}
