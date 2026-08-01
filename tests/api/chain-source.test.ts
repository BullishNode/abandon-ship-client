import { describe, expect, it } from 'vitest'
import { buildChainSource } from '../../api/src/chain-source.ts'

const ESPLORA_URL = 'https://esplora.signet.2nd.dev'
const BITCOIND_URL = '127.0.0.1:38332'
const COOKIE_FILE = '/root/.bitcoin/signet/.cookie'

const esploraResult = { esplora: { url: ESPLORA_URL } }
const bitcoindResult = {
  bitcoind: {
    bitcoind: BITCOIND_URL,
    bitcoindAuth: { cookie: { cookie: COOKIE_FILE } }
  }
}

describe(buildChainSource, () => {
  it('builds an esplora chain source from CHAIN_SOURCE alone', () => {
    const result = buildChainSource({ chainSource: ESPLORA_URL })
    expect(result.chainSource).toStrictEqual(esploraResult)
    expect(result.warnings).toStrictEqual([])
  })

  it('builds a bitcoind chain source with cookie auth', () => {
    const result = buildChainSource({
      bitcoindRpcCookieFile: COOKIE_FILE,
      bitcoindRpcUrl: BITCOIND_URL
    })
    expect(result.chainSource).toStrictEqual(bitcoindResult)
    expect(result.warnings).toStrictEqual([])
  })

  it('lets bitcoind win over esplora and warns', () => {
    const result = buildChainSource({
      bitcoindRpcCookieFile: COOKIE_FILE,
      bitcoindRpcUrl: BITCOIND_URL,
      chainSource: ESPLORA_URL
    })
    expect(result.chainSource).toStrictEqual(bitcoindResult)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('ignoring CHAIN_SOURCE')
  })

  it('warns and falls back to esplora when the cookie file var is unset', () => {
    const result = buildChainSource({
      bitcoindRpcUrl: BITCOIND_URL,
      chainSource: ESPLORA_URL
    })
    expect(result.chainSource).toStrictEqual(esploraResult)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('BITCOIND_RPC_COOKIE_FILE')
  })

  it('returns no chain source when the cookie file var is unset and no esplora is configured', () => {
    const result = buildChainSource({ bitcoindRpcUrl: BITCOIND_URL })
    expect(result.chainSource).toBeUndefined()
    expect(result.warnings).toHaveLength(2)
  })

  it('returns no chain source and warns when nothing is configured', () => {
    const result = buildChainSource({})
    expect(result.chainSource).toBeUndefined()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('No chain source configured')
  })

  // Compose interpolates unset variables to the empty string rather than
  // omitting them, so blank must be treated exactly like absent.
  it('treats blank and whitespace-only values as unset', () => {
    const result = buildChainSource({
      bitcoindRpcCookieFile: '  ',
      bitcoindRpcUrl: '',
      chainSource: `  ${ESPLORA_URL}  `
    })
    expect(result.chainSource).toStrictEqual(esploraResult)
    expect(result.warnings).toStrictEqual([])
  })
})
