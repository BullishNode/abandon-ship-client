import { downloadBlob } from '@/utils/download'

const LOGS_ENDPOINT = '/api/logs'
const LOGS_DOWNLOAD_NAME = 'barkd-debug.log'

export async function downloadDebugLog(): Promise<void> {
  const response = await fetch(LOGS_ENDPOINT)
  if (!response.ok) {
    throw new Error(`Failed to download logs: ${response.status}`)
  }
  const blob = await response.blob()
  downloadBlob(blob, LOGS_DOWNLOAD_NAME)
}
