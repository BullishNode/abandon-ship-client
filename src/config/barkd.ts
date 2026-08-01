import { BarkNetwork, Configuration } from '@secondts/barkd'
import type { ChainSourceConfig } from '@secondts/barkd'
import { z } from 'zod'
import { useAuthStore } from '@/stores/auth'
import { chainSourceLabel } from '@/utils/chain-source'

const UNAUTHORIZED = 401

const authMiddleware = {
  // oxlint-disable-next-line require-await
  post: async ({ response }: { response: Response }): Promise<Response> => {
    const { authRequired, setStatus } = useAuthStore.getState()
    if (response.status === UNAUTHORIZED && authRequired) {
      setStatus({ authRequired: true, authed: false })
    }
    return response
  }
}

declare global {
  interface Window {
    __BARKD__?: { token?: string }
  }
}

interface RuntimeConfig {
  arkServer: string
  chainSource: ChainSourceConfig
  network: BarkNetwork
  walletDataPath: string
  client: Configuration
}

// Unknown shapes must fail here rather than be coerced: the generated
// `ChainSourceConfigToJSON` returns `{}` for a value matching neither variant,
// which would POST `chain_source: {}` and fail at barkd with a confusing error.
// The bitcoind address and cookie path are not URLs — operators may supply a
// bare `host:port` and a filesystem path, and barkd validates the rest.
// bitcoind is matched before esplora so a payload carrying both keys resolves
// the same way the api's builder does.
const chainSourceSchema = z.union([
  // barkd's embedded build serves its own `/api/config` and still sends a plain
  // esplora URL.
  z.url().transform((url) => ({ esplora: { url } })),
  z.object({
    bitcoind: z.object({
      bitcoind: z.string().min(1),
      bitcoindAuth: z.object({ cookie: z.object({ cookie: z.string().min(1) }) })
    })
  }),
  z.object({ esplora: z.object({ url: z.url() }) })
])

const configResponseSchema = z.object({
  arkServer: z.url(),
  chainSource: chainSourceSchema,
  network: z.enum([
    BarkNetwork.Mainnet,
    BarkNetwork.Signet,
    BarkNetwork.Mutinynet,
    BarkNetwork.Regtest
  ]),
  walletDataPath: z.string().default('/data/.bark/')
})

let runtime: RuntimeConfig | undefined

// When barkd serves this SPA itself (embedded build), it injects its bearer
// token via `window.__BARKD__.token` (see the `<!--barkd-token-->` marker in
// index.html). In the proxied dev/docker flows nothing is injected and the
// proxy adds the bearer server-side, so this returns undefined and the client
// sends no Authorization header of its own.
function injectedToken(): string | undefined {
  const token = window.__BARKD__?.token
  return token !== undefined && token.length > 0 ? token : undefined
}

function requireConfig(): RuntimeConfig {
  if (runtime === undefined) {
    throw new Error('Bark config not loaded. Call initConfig() first.')
  }
  return runtime
}

export const config = {
  get arkServer(): string {
    return requireConfig().arkServer
  },
  get chainSource(): ChainSourceConfig {
    return requireConfig().chainSource
  },
  get chainSourceLabel(): string {
    return chainSourceLabel(requireConfig().chainSource)
  },
  get client(): Configuration {
    return requireConfig().client
  },
  get network(): BarkNetwork {
    return requireConfig().network
  },
  get walletDataPath(): string {
    return requireConfig().walletDataPath
  }
}

export async function initConfig(): Promise<void> {
  const response = await fetch('/api/config')
  if (!response.ok) {
    throw new Error(`Failed to load /api/config: ${response.status}`)
  }
  const json: unknown = await response.json()
  const parsed = configResponseSchema.parse(json)
  const token = injectedToken()
  runtime = {
    arkServer: parsed.arkServer,
    chainSource: parsed.chainSource,
    client: new Configuration({
      basePath: '/api/barkd',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'bark' },
      middleware: [authMiddleware],
      ...(token === undefined ? {} : { accessToken: token })
    }),
    network: parsed.network,
    walletDataPath: parsed.walletDataPath
  }
}

export function __setRuntimeConfigForTests(value: RuntimeConfig): void {
  runtime = value
}
