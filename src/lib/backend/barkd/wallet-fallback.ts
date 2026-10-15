import { BaseAPI } from '@secondts/barkd'
import { z } from 'zod'
import { address } from 'bitcoinjs-lib'
import { config } from '@/config/runtime'
import { clientConfig } from '@/lib/backend/barkd/client-config'
import { networkFor } from '@/utils/bitcoin'

const destinationSchema = z.object({
  address: z.string().min(1),
  seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
})

export class WalletFallbackApi extends BaseAPI {
  async destination(): Promise<z.infer<typeof destinationSchema>> {
    const response = await this.request({ headers: {}, method: 'GET', path: '/api/v1/wallet/fallback-destination' })
    const value = destinationSchema.parse(await response.json())
    // Check address encoding for the configured network. Shared test-network
    // prefixes do not attest the server's chain identity.
    address.toOutputScript(value.address, networkFor(config.network))
    return value
  }

  async sync(): Promise<void> {
    // Both are real native routes. Wallet sync alone does not sync BDK.
    await this.request({ headers: {}, method: 'POST', path: '/api/v1/onchain/sync' })
    await this.request({ headers: {}, method: 'POST', path: '/api/v1/wallet/sync' })
  }
}

export const walletFallbackApi = new WalletFallbackApi(clientConfig)
