import { useMutation } from '@tanstack/react-query'
import type { UseMutationOptions } from '@tanstack/react-query'
import { downloadWalletBackup } from '@/lib/bark-web-api-client'

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function useDownloadBackup(options?: Omit<UseMutationOptions<void>, 'mutationFn'>) {
  return useMutation({
    mutationFn: async () => {
      const { blob, filename } = await downloadWalletBackup()
      triggerBrowserDownload(blob, filename)
    },
    ...options
  })
}
