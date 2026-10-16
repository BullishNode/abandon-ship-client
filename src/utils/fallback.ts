import { z } from 'zod'
import type { Movement } from '@/types/domain/movement'

const receiptSchema = z.object({
  chain_view_valid: z.boolean(),
  forfeited_sat: z.number().int().nonnegative().safe(),
  output_index: z.number().int().nonnegative().nullable(),
  payout_sat: z.number().int().nonnegative().safe(),
  stage: z.enum([
    'committed',
    'broadcast',
    'confirmed',
    'conflicted',
    'below_dust',
    'awaiting_settlement'
  ]),
  txid: z
    .string()
    .regex(/^[a-f\d]{64}$/u)
    .nullable()
})

export function isFallbackPayout(movement: Movement): boolean {
  return movement.subsystem.name === 'abandon.fallback_payout'
}

export function fallbackReceipt(movement: Movement) {
  if (!isFallbackPayout(movement)) {
    return null
  }
  const parsed = receiptSchema.safeParse(movement.metadata?.fallback)
  return parsed.success ? parsed.data : null
}
