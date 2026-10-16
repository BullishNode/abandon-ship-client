import { z } from 'zod'
import { authedFetch } from '@/lib/backend/barkd/authed-fetch'

const registrationSchema = z
  .object({
    history_awaiting_sync: z.boolean().optional().default(false),
    payout_address: z.string().min(1).nullable(),
    registered: z.boolean()
  })
  .refine(
    (record) => record.registered === (record.payout_address !== null),
    'Inconsistent fallback registration'
  )

export type FallbackRegistration = z.infer<typeof registrationSchema>

export async function fallbackRegistration(): Promise<FallbackRegistration> {
  const response = await authedFetch('/api/barkd/api/v1/wallet/fallback', {
    headers: { 'X-Requested-With': 'bark' }
  })
  if (!response.ok) {
    throw new Error(`Fallback registration unavailable (${response.status})`)
  }
  return registrationSchema.parse(await response.json())
}
