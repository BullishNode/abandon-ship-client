// Keep this module dependency-free: `docker/bark-web-api.Dockerfile` builds api
// in isolation from `api/package-lock.json`, so importing `@secondts/barkd` to
// type the return value compiles locally (workspace hoisting) but fails TS2307
// in the release image. `src/config/barkd.ts` checks the shapes below against
// the real `ChainSourceConfig` instead.

interface EsploraChainSource {
  esplora: { url: string }
}

interface BitcoindChainSource {
  bitcoind: {
    bitcoind: string
    bitcoindAuth: { cookie: { cookie: string } }
  }
}

export type ChainSourceJson = BitcoindChainSource | EsploraChainSource

export interface ChainSourceEnv {
  bitcoindRpcCookieFile?: string
  bitcoindRpcUrl?: string
  chainSource?: string
}

export interface ChainSourceResult {
  chainSource: ChainSourceJson | undefined
  warnings: string[]
}

const MISSING_COOKIE_WARNING =
  'BITCOIND_RPC_URL is set but BITCOIND_RPC_COOKIE_FILE is empty. Ignoring the bitcoind chain source.'
const BOTH_SET_WARNING =
  'BITCOIND_RPC_URL and CHAIN_SOURCE are both set. Using bitcoind and ignoring CHAIN_SOURCE.'
const NONE_SET_WARNING =
  'No chain source configured. Set CHAIN_SOURCE, or BITCOIND_RPC_URL with BITCOIND_RPC_COOKIE_FILE.'

function trimmed(value: string | undefined): string {
  return value?.trim() ?? ''
}

// The cookie file is never `stat`ed: the api container does not share barkd's
// mounts, so an existence check would false-negative on a correct setup and
// silently downgrade to esplora.
export function buildChainSource(env: ChainSourceEnv): ChainSourceResult {
  const esploraUrl = trimmed(env.chainSource)
  const bitcoindUrl = trimmed(env.bitcoindRpcUrl)
  const cookieFile = trimmed(env.bitcoindRpcCookieFile)
  const esplora = esploraUrl.length > 0 ? { esplora: { url: esploraUrl } } : undefined
  const warnings: string[] = []

  if (bitcoindUrl.length === 0) {
    if (esplora === undefined) {
      warnings.push(NONE_SET_WARNING)
    }
    return { chainSource: esplora, warnings }
  }

  // Falling back to esplora syncs a new wallet from the wrong source; omitting
  // the chain source fails `initConfig()` and locks users out of existing
  // wallets too. The fallback is the smaller blast radius.
  if (cookieFile.length === 0) {
    warnings.push(MISSING_COOKIE_WARNING)
    if (esplora === undefined) {
      warnings.push(NONE_SET_WARNING)
    }
    return { chainSource: esplora, warnings }
  }

  if (esplora !== undefined) {
    warnings.push(BOTH_SET_WARNING)
  }

  return {
    chainSource: {
      bitcoind: {
        bitcoind: bitcoindUrl,
        bitcoindAuth: { cookie: { cookie: cookieFile } }
      }
    },
    warnings
  }
}
