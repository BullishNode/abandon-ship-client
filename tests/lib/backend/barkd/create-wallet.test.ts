import { beforeEach, describe, expect, it, vi } from 'vitest'
import { barkdBackend } from '@/lib/backend/barkd'

vi.mock(import('@/config/runtime'), () => ({
  config: {
    arkServer: 'http://ark:3535',
    chainSource: {
      bitcoind: {
        bitcoind: 'http://bitcoind:8332',
        bitcoindAuth: { cookie: { cookie: '/test/core.cookie' } }
      }
    },
    chainSourceLabel: 'Bitcoin Core',
    network: 'signet' as const,
    walletDataPath: '/data/.bark'
  }
}))

describe('wallet creation with a browser generated mnemonic', () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(Response.json({ fingerprint: 'abcdef01' }))
    vi.stubGlobal('fetch', fetchMock)
  })

  it.each([
    { birthdayHeight: undefined, fresh: true, restore: false },
    { birthdayHeight: 325_000, fresh: false, restore: true },
    { birthdayHeight: undefined, fresh: false, restore: undefined }
  ])('preserves create/restore intent: $restore', async ({ restore, birthdayHeight, fresh }) => {
    await barkdBackend.walletApi.createWallet({
      birthdayHeight,
      mnemonic: 'test mnemonic',
      restore
    })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('/api/barkd/api/v1/wallet/create')
    const body: Record<string, unknown> = JSON.parse(String(init?.body))
    expect(body).toMatchObject({ fresh_mnemonic: fresh, mnemonic: 'test mnemonic' })
    expect(body.birthday_height).toBe(birthdayHeight)
  })
})
