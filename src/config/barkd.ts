import { BarkNetwork, Configuration } from '@secondts/barkd'
import { z } from 'zod'

interface RuntimeConfig {
  arkServer: string
  chainSource: string
  network: BarkNetwork
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
  ])
})

let runtime: RuntimeConfig | undefined

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
  }
}

export async function initConfig(): Promise<void> {
  const response = await fetch('/api/config')
  if (!response.ok) {
    throw new Error(`Failed to load /api/config: ${response.status}`)
  }
  const json: unknown = await response.json()
  const parsed = configResponseSchema.parse(json)
  runtime = {
    arkServer: parsed.arkServer,
    chainSource: parsed.chainSource,
    client: new Configuration({ basePath: '/api/barkd' }),
    network: parsed.network
  }
}

export function __setRuntimeConfigForTests(value: RuntimeConfig): void {
  runtime = value
}
