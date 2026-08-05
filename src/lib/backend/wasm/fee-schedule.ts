import { z } from 'zod'
import type { FeeSchedule } from '@/types/domain/fees'

const ppmExpiryEntrySchema = z
  .object({
    expiry_blocks_threshold: z.number(),
    ppm: z.number()
  })
  .transform((entry) => ({
    expiryBlocksThreshold: entry.expiry_blocks_threshold,
    ppm: entry.ppm
  }))

const ppmExpiryTableSchema = z.array(ppmExpiryEntrySchema)

const feeScheduleSchema = z
  .object({
    board: z.object({
      base_fee_sat: z.number(),
      min_fee_sat: z.number(),
      ppm: z.number()
    }),
    lightning_receive: z.object({
      base_fee_sat: z.number(),
      ppm: z.number()
    }),
    lightning_send: z.object({
      base_fee_sat: z.number(),
      min_fee_sat: z.number(),
      ppm_expiry_table: ppmExpiryTableSchema
    }),
    offboard: z.object({
      base_fee_sat: z.number(),
      fixed_additional_vb: z.number(),
      ppm_expiry_table: ppmExpiryTableSchema
    }),
    refresh: z.object({
      base_fee_sat: z.number(),
      ppm_expiry_table: ppmExpiryTableSchema
    })
  })
  .transform(
    (dto): FeeSchedule => ({
      board: {
        baseFeeSats: dto.board.base_fee_sat,
        minFeeSats: dto.board.min_fee_sat,
        ppm: dto.board.ppm
      },
      lightningReceive: {
        baseFeeSats: dto.lightning_receive.base_fee_sat,
        ppm: dto.lightning_receive.ppm
      },
      lightningSend: {
        baseFeeSats: dto.lightning_send.base_fee_sat,
        minFeeSats: dto.lightning_send.min_fee_sat,
        ppmExpiryTable: dto.lightning_send.ppm_expiry_table
      },
      offboard: {
        baseFeeSats: dto.offboard.base_fee_sat,
        fixedAdditionalVb: dto.offboard.fixed_additional_vb,
        ppmExpiryTable: dto.offboard.ppm_expiry_table
      },
      refresh: {
        baseFeeSats: dto.refresh.base_fee_sat,
        ppmExpiryTable: dto.refresh.ppm_expiry_table
      }
    })
  )

export function parseFeeSchedule(json: string): FeeSchedule | undefined {
  if (json.length === 0) {
    return undefined
  }
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return undefined
  }
  const parsed = feeScheduleSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}
