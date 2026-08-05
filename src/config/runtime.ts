import { z } from 'zod'
import type { ChainSource } from '@/types/domain/chain-source'
import { NETWORKS } from '@/types/domain/network'
import type { Network } from '@/types/domain/network'
import { chainSourceLabel } from '@/utils/chain-source'

export interface RuntimeConfig {
  arkServer: string
  chainSource: ChainSource
  network: Network
  walletDataPath: string
}

// Unknown shapes must fail here rather than be coerced: the generated
// `ChainSourceConfigToJSON` returns `{}` for a value matching neither variant,
// which would POST `chain_source: {}` and fail at barkd with a confusing error.
// The bitcoind address and cookie path are not URLs — operators may supply a
// bare `host:port` and a filesystem path, and barkd validates the rest.
// bitcoind is matched before esplora so a payload carrying both keys resolves
const bitcoindChainSourceSchema = z.object({
  bitcoind: z.object({
    bitcoind: z.string().min(1),
    bitcoindAuth: z.object({ cookie: z.object({ cookie: z.string().min(1) }) })
  })
})

const esploraChainSourceSchema = z.object({ esplora: z.object({ url: z.url() }) })
const legacyEsploraUrlSchema = z.url().transform((url) => ({ esplora: { url } }))

function chainSourceSchemaFor(value: unknown) {
  if (typeof value === 'string') {
    return legacyEsploraUrlSchema
  }
  if (typeof value === 'object' && value !== null && 'bitcoind' in value) {
    return bitcoindChainSourceSchema
  }
  return esploraChainSourceSchema
}

const chainSourceSchema = z.unknown().transform((value) => chainSourceSchemaFor(value).parse(value))

const configResponseSchema = z.object({
  arkServer: z.url(),
  chainSource: chainSourceSchema,
  network: z.enum(NETWORKS),
  walletDataPath: z.string().default('/data/.bark/')
})

let runtime: RuntimeConfig | undefined

function requireConfig(): RuntimeConfig {
  if (runtime === undefined) {
    throw new Error('Runtime config not loaded. Call initConfig() first.')
  }
  return runtime
}

export const config = {
  get arkServer(): string {
    return requireConfig().arkServer
  },
  get chainSource(): ChainSource {
    return requireConfig().chainSource
  },
  get chainSourceLabel(): string {
    return chainSourceLabel(requireConfig().chainSource)
  },
  get network(): Network {
    return requireConfig().network
  },
  get walletDataPath(): string {
    return requireConfig().walletDataPath
  }
}

// WASM build: config is baked in at build time (Vite `define`), the browser
// talks to the ark server + esplora directly, and wallet state lives in
// IndexedDB rather than a server data dir.
function loadWasmConfig(): RuntimeConfig {
  if (__WASM_CONFIG__ === null) {
    throw new Error('WASM config missing. Set ARK_SERVER / CHAIN_SOURCE / BARK_NETWORK.')
  }
  const parsed = configResponseSchema.parse({
    ...__WASM_CONFIG__,
    walletDataPath: 'browser IndexedDB'
  })
  if (!('esplora' in parsed.chainSource)) {
    throw new Error('WASM build requires an esplora chain source URL.')
  }
  return parsed
}

// barkd build: the Hono proxy serves runtime config from the daemon.
async function loadBarkdConfig(): Promise<RuntimeConfig> {
  const response = await fetch('/api/config')
  if (!response.ok) {
    throw new Error(`Failed to load /api/config: ${response.status}`)
  }
  const json: unknown = await response.json()
  return configResponseSchema.parse(json)
}

export async function initConfig(): Promise<void> {
  runtime = __BACKEND__ === 'wasm' ? loadWasmConfig() : await loadBarkdConfig()
}

export function __setRuntimeConfigForTests(value: RuntimeConfig): void {
  runtime = value
}
