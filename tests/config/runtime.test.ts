import { afterEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { buildChainSource } from '../../api/src/chain-source.ts'
import { config, initConfig } from '../../src/config/runtime'

const COOKIE_FILE = '/root/.bitcoin/signet/.cookie'

const baseResponse = {
  arkServer: 'https://ark.signet.2nd.dev',
  network: 'signet',
  walletDataPath: '/data/.bark/'
}

function mockConfigResponse(body: Record<string, unknown>) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body))
}

describe(initConfig, () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes a legacy plain esplora URL into the union object', async () => {
    mockConfigResponse({ ...baseResponse, chainSource: 'https://esplora.signet.2nd.dev' })
    await initConfig()
    expect(config.chainSource).toStrictEqual({
      esplora: { url: 'https://esplora.signet.2nd.dev' }
    })
    expect(config.chainSourceLabel).toBe('https://esplora.signet.2nd.dev')
  })

  it('accepts an esplora union object', async () => {
    mockConfigResponse({
      ...baseResponse,
      chainSource: { esplora: { url: 'https://esplora.signet.2nd.dev' } }
    })
    await initConfig()
    expect(config.chainSource).toStrictEqual({
      esplora: { url: 'https://esplora.signet.2nd.dev' }
    })
    expect(config.chainSourceLabel).toBe('https://esplora.signet.2nd.dev')
  })

  it('accepts a bitcoind union object with cookie auth', async () => {
    mockConfigResponse({
      ...baseResponse,
      chainSource: {
        bitcoind: {
          bitcoind: '127.0.0.1:38332',
          bitcoindAuth: { cookie: { cookie: COOKIE_FILE } }
        }
      }
    })
    await initConfig()
    expect(config.chainSource).toStrictEqual({
      bitcoind: {
        bitcoind: '127.0.0.1:38332',
        bitcoindAuth: { cookie: { cookie: COOKIE_FILE } }
      }
    })
  })

  it('prefers bitcoind when a payload carries both keys, matching the api builder', async () => {
    mockConfigResponse({
      ...baseResponse,
      chainSource: {
        bitcoind: {
          bitcoind: '127.0.0.1:38332',
          bitcoindAuth: { cookie: { cookie: COOKIE_FILE } }
        },
        esplora: { url: 'https://esplora.signet.2nd.dev' }
      }
    })
    await initConfig()
    expect(config.chainSource).toStrictEqual({
      bitcoind: {
        bitcoind: '127.0.0.1:38332',
        bitcoindAuth: { cookie: { cookie: COOKIE_FILE } }
      }
    })
  })

  it('labels a bitcoind chain source by its RPC address, never the cookie path', async () => {
    mockConfigResponse({
      ...baseResponse,
      chainSource: {
        bitcoind: {
          bitcoind: '127.0.0.1:38332',
          bitcoindAuth: { cookie: { cookie: COOKIE_FILE } }
        }
      }
    })
    await initConfig()
    expect(config.chainSourceLabel).toBe('127.0.0.1:38332')
    expect(config.chainSourceLabel).not.toContain(COOKIE_FILE)
  })

  it('rejects a payload with no chain source', async () => {
    mockConfigResponse(baseResponse)
    await expect(initConfig()).rejects.toThrow(ZodError)
  })

  it('rejects an empty chain source string', async () => {
    mockConfigResponse({ ...baseResponse, chainSource: '' })
    await expect(initConfig()).rejects.toThrow(ZodError)
  })

  // Without this, `ChainSourceConfigToJSON` would silently emit
  // `chain_source: {}` and barkd would fail the request with a confusing error.
  it('rejects an unknown chain source shape rather than coercing it', async () => {
    mockConfigResponse({ ...baseResponse, chainSource: { electrum: { url: 'tcp://host:50001' } } })
    await expect(initConfig()).rejects.toThrow(ZodError)
  })

  it('rejects a bitcoind chain source that is missing its auth', async () => {
    mockConfigResponse({
      ...baseResponse,
      chainSource: { bitcoind: { bitcoind: '127.0.0.1:38332' } }
    })
    await expect(initConfig()).rejects.toThrow(ZodError)
  })

  it('rejects a malformed bitcoind entry even when a valid esplora one sits beside it', async () => {
    mockConfigResponse({
      ...baseResponse,
      chainSource: {
        bitcoind: { bitcoind: '127.0.0.1:38332' },
        esplora: { url: 'https://esplora.signet.2nd.dev' }
      }
    })
    await expect(initConfig()).rejects.toThrow(ZodError)
  })

  it('rejects a bitcoind chain source with an empty cookie path', async () => {
    mockConfigResponse({
      ...baseResponse,
      chainSource: {
        bitcoind: { bitcoind: '127.0.0.1:38332', bitcoindAuth: { cookie: { cookie: '' } } }
      }
    })
    await expect(initConfig()).rejects.toThrow(ZodError)
  })
})

// The api types its payload structurally and cannot import the client, so this
// is what keeps the two shapes from drifting apart.
describe('api-built chain sources', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    { chainSource: 'https://esplora.signet.2nd.dev' },
    { bitcoindRpcCookieFile: COOKIE_FILE, bitcoindRpcUrl: '127.0.0.1:38332' },
    {
      bitcoindRpcCookieFile: COOKIE_FILE,
      bitcoindRpcUrl: '127.0.0.1:38332',
      chainSource: 'https://esplora.signet.2nd.dev'
    }
  ])('parse unchanged in the SPA: %j', async (env) => {
    const { chainSource } = buildChainSource(env)
    mockConfigResponse({ ...baseResponse, chainSource })
    await initConfig()
    expect(config.chainSource).toStrictEqual(chainSource)
    expect(config.chainSourceLabel).not.toContain(COOKIE_FILE)
  })
})
