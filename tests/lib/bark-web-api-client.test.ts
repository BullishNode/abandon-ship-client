import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadWalletBackup } from '../../src/lib/bark-web-api-client'

interface FetchInit {
  credentials?: RequestCredentials
}
type FetchFn = (url: string, init: FetchInit) => Promise<Response>

function makeResponse(init: {
  body?: string
  ok: boolean
  status?: number
  contentDisposition?: string | null
}): Response {
  const headers = new Headers()
  if (init.contentDisposition !== null && init.contentDisposition !== undefined) {
    headers.set('Content-Disposition', init.contentDisposition)
  }
  const status = init.status ?? (init.ok ? 200 : 500)
  return new Response(init.body ?? '', { headers, status })
}

describe(downloadWalletBackup, () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchFn>>

  beforeEach(() => {
    fetchMock = vi.fn<FetchFn>()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls /api/backup with same-origin credentials', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        body: 'zip',
        contentDisposition: 'attachment; filename="x.zip"',
        ok: true
      })
    )
    await downloadWalletBackup()
    expect(fetchMock).toHaveBeenCalledOnce()
    const [firstCall] = fetchMock.mock.calls
    const [url, options] = firstCall
    expect(url).toBe('/api/backup')
    expect(options).toMatchObject({ credentials: 'same-origin' })
  })

  it('extracts filename from Content-Disposition header', async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        body: 'zip',
        contentDisposition: 'attachment; filename="bark-2026-05-13.zip"',
        ok: true
      })
    )
    const result = await downloadWalletBackup()
    expect(result.filename).toBe('bark-2026-05-13.zip')
    const bytes = await result.blob.text()
    expect(bytes).toBe('zip')
  })

  it('falls back to a default filename when header is missing', async () => {
    fetchMock.mockResolvedValue(makeResponse({ contentDisposition: null, ok: true }))
    const result = await downloadWalletBackup()
    expect(result.filename).toBe('bark-wallet-backup.zip')
  })

  it('falls back to default when Content-Disposition lacks filename', async () => {
    fetchMock.mockResolvedValue(makeResponse({ contentDisposition: 'attachment', ok: true }))
    const result = await downloadWalletBackup()
    expect(result.filename).toBe('bark-wallet-backup.zip')
  })

  it('throws with the response body when !ok and body is non-empty', async () => {
    fetchMock.mockResolvedValue(makeResponse({ body: 'boom', ok: false, status: 500 }))
    await expect(downloadWalletBackup()).rejects.toThrow('boom')
  })

  it('throws with a generic message when !ok and body is empty', async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 503 }))
    await expect(downloadWalletBackup()).rejects.toThrow('Request failed: 503')
  })
})
