import { BaseAPI } from '@secondts/barkd'
import { z } from 'zod'
import type { SendParams, SendResult } from '@/types/domain/wallet'

const responseSchema = z.object({ message: z.string() })

// The pinned generated client predates this native payer option. Use its
// authenticated request machinery and preserve native refusal without retry.
export class StrictLnurlSendApi extends BaseAPI {
  async send({ destination, amountSats, comment }: SendParams): Promise<SendResult> {
    const response = await this.request({
      path: '/api/v1/wallet/send',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        destination,
        amount_sat: amountSats,
        comment,
        require_lnurl_metadata: true
      }
    })
    return responseSchema.parse(await response.json())
  }
}
