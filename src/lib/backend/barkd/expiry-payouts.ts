import { BaseAPI } from '@secondts/barkd'
import { z } from 'zod'
import type { ServerVtxoStatus } from '@/types/domain/expiry-payout'

const serverVtxoStatusSchema = z.object({ state: z.string(), vtxo_id: z.string() })

// This C-native route reconciles the Ark debit. A spent status alone does not
// identify a payout or prove that the registered destination has received it.
export class ExpiryPayoutsApi extends BaseAPI {
  async adoptServerVtxoStatus(vtxoIds: string[]): Promise<ServerVtxoStatus[]> {
    const response = await this.request({
      body: { vtxo_ids: vtxoIds },
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      path: '/api/v1/wallet/vtxos/adopt-server-status'
    })
    const json: unknown = await response.json()
    return z.array(serverVtxoStatusSchema).parse(json).map((dto) => ({
      state: dto.state,
      vtxoId: dto.vtxo_id
    }))
  }
}
