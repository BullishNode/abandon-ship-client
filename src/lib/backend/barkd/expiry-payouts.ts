import { BaseAPI } from '@secondts/barkd'
import { z } from 'zod'
import type { ServerVtxoStatus } from '@/types/domain/expiry-payout'

// The expired-coin route is not in any @secondts/barkd release, so it
// is called through the generated client's base class: same base path, auth
// middleware and ResponseError on a non-2xx status.

const serverVtxoStatusSchema = z.object({ state: z.string(), vtxo_id: z.string() })

export function toServerVtxoStatus(json: unknown): ServerVtxoStatus {
  const dto = serverVtxoStatusSchema.parse(json)
  return { state: dto.state, vtxoId: dto.vtxo_id }
}

export class ExpiryPayoutsApi extends BaseAPI {
  private async post(path: string, body: object): Promise<unknown> {
    const response = await this.request({
      body,
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      path
    })
    const json: unknown = await response.json()
    return json
  }

  async adoptServerVtxoStatus(vtxoIds: string[]): Promise<ServerVtxoStatus[]> {
    const json = await this.post('/api/v1/wallet/vtxos/adopt-server-status', {
      vtxo_ids: vtxoIds
    })
    return z.array(z.unknown()).parse(json).map(toServerVtxoStatus)
  }
}
