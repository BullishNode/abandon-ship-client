import { BarkNetwork, Configuration } from '@secondts/barkd'
import { z } from 'zod'

declare global {
  interface Window {
    __BARKD__?: { token?: string }
  }
}

interface RuntimeConfig {
  arkServer: string
  chainSource: string
  network: BarkNetwork
  walletDataPath: string
  client: Configuration
}

const configResponseSchema = z.object({
  arkServer: z.url(),
  chainSource: z.url(),
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
  get chainSource(): string {
    return requireConfig().chainSource
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
      ...(token === undefined ? {} : { accessToken: token })
    }),
    network: parsed.network,
    walletDataPath: parsed.walletDataPath
  }
}

export function __setRuntimeConfigForTests(value: RuntimeConfig): void {
  runtime = value
}
