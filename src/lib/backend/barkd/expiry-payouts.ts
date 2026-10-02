import { BaseAPI } from '@secondts/barkd'
import { z } from 'zod'
import type {
  ExpiryPayout,
  ExpiryPayoutSweep,
  ServerVtxoStatus
} from '@/types/domain/expiry-payout'
import { toServerVtxoState } from '@/utils/expiry-payout'

// Bull's expired-coin routes are not in any @secondts/barkd release, so they
// are called through the generated client's base class: same base path, auth
// middleware and ResponseError on a non-2xx status.

const serverVtxoStatusSchema = z.object({ state: z.string(), vtxo_id: z.string() })

const expiryPayoutSchema = z.object({
  amount_sat: z.number(),
  confirmations: z.number(),
  txid: z.string(),
  vout: z.number(),
  vtxo_id: z.string()
})

const expiryPayoutSweepSchema = z.object({ swept_sat: z.number(), txid: z.string() })

export function toServerVtxoStatus(json: unknown): ServerVtxoStatus {
  const dto = serverVtxoStatusSchema.parse(json)
  return { state: toServerVtxoState(dto.state), vtxoId: dto.vtxo_id }
}

export function toExpiryPayout(json: unknown): ExpiryPayout {
  const dto = expiryPayoutSchema.parse(json)
  return {
    amountSats: dto.amount_sat,
    confirmations: dto.confirmations,
    txid: dto.txid,
    vout: dto.vout,
    vtxoId: dto.vtxo_id
  }
}

export function toExpiryPayoutSweep(json: unknown): ExpiryPayoutSweep {
  const dto = expiryPayoutSweepSchema.parse(json)
  return { sweptSats: dto.swept_sat, txid: dto.txid }
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

  async adoptServerVtxoStatus(vtxoIds?: string[]): Promise<ServerVtxoStatus[]> {
    const json = await this.post('/api/v1/wallet/vtxos/adopt-server-status', {
      vtxo_ids: vtxoIds
    })
    return z.array(z.unknown()).parse(json).map(toServerVtxoStatus)
  }

  async findExpiryPayouts(vtxoIds?: string[]): Promise<ExpiryPayout[]> {
    const json = await this.post('/api/v1/wallet/vtxos/expiry-payouts', { vtxo_ids: vtxoIds })
    return z.array(z.unknown()).parse(json).map(toExpiryPayout)
  }

  async sweepExpiryPayouts(feeRateSatPerVb?: number): Promise<ExpiryPayoutSweep> {
    const json = await this.post('/api/v1/onchain/sweep-expiry-payouts', {
      fee_rate_sat_vb: feeRateSatPerVb
    })
    return toExpiryPayoutSweep(json)
  }
}
