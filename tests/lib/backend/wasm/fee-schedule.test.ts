import { describe, expect, it } from 'vitest'
import { parseFeeSchedule } from '@/lib/backend/wasm/fee-schedule'

const FEE_SCHEDULE_JSON = JSON.stringify({
  board: { base_fee_sat: 100, min_fee_sat: 250, ppm: 500 },
  lightning_receive: { base_fee_sat: 50, ppm: 1000 },
  lightning_send: {
    base_fee_sat: 75,
    min_fee_sat: 200,
    ppm_expiry_table: [
      { expiry_blocks_threshold: 0, ppm: 0 },
      { expiry_blocks_threshold: 144, ppm: 500 }
    ]
  },
  offboard: {
    base_fee_sat: 300,
    fixed_additional_vb: 43,
    ppm_expiry_table: [{ expiry_blocks_threshold: 0, ppm: 0 }]
  },
  refresh: {
    base_fee_sat: 25,
    ppm_expiry_table: [
      { expiry_blocks_threshold: 0, ppm: 0 },
      { expiry_blocks_threshold: 145, ppm: 250 },
      { expiry_blocks_threshold: 289, ppm: 750 }
    ]
  }
})

describe(parseFeeSchedule, () => {
  it('parses the bindings snake_case JSON into the camelCase domain schedule', () => {
    expect(parseFeeSchedule(FEE_SCHEDULE_JSON)).toStrictEqual({
      board: { baseFeeSats: 100, minFeeSats: 250, ppm: 500 },
      lightningReceive: { baseFeeSats: 50, ppm: 1000 },
      lightningSend: {
        baseFeeSats: 75,
        minFeeSats: 200,
        ppmExpiryTable: [
          { expiryBlocksThreshold: 0, ppm: 0 },
          { expiryBlocksThreshold: 144, ppm: 500 }
        ]
      },
      offboard: {
        baseFeeSats: 300,
        fixedAdditionalVb: 43,
        ppmExpiryTable: [{ expiryBlocksThreshold: 0, ppm: 0 }]
      },
      refresh: {
        baseFeeSats: 25,
        ppmExpiryTable: [
          { expiryBlocksThreshold: 0, ppm: 0 },
          { expiryBlocksThreshold: 145, ppm: 250 },
          { expiryBlocksThreshold: 289, ppm: 750 }
        ]
      }
    })
  })

  it('returns undefined for an empty string', () => {
    expect(parseFeeSchedule('')).toBeUndefined()
  })

  it('returns undefined for malformed JSON', () => {
    expect(parseFeeSchedule('{"board":')).toBeUndefined()
  })

  it('returns undefined for JSON that is not an object', () => {
    expect(parseFeeSchedule('"a string"')).toBeUndefined()
    expect(parseFeeSchedule('null')).toBeUndefined()
  })

  // A bindings shape change must degrade the fee UI, not throw out of toArkInfo.
  it('returns undefined when a section is missing', () => {
    const withoutRefresh: Record<string, unknown> = JSON.parse(FEE_SCHEDULE_JSON)
    delete withoutRefresh.refresh
    expect(parseFeeSchedule(JSON.stringify(withoutRefresh))).toBeUndefined()
  })

  it('returns undefined when a field is renamed or retyped', () => {
    expect(
      parseFeeSchedule(FEE_SCHEDULE_JSON.replace('base_fee_sat', 'baseFeeSat'))
    ).toBeUndefined()
    expect(parseFeeSchedule(FEE_SCHEDULE_JSON.replace('"ppm":500', '"ppm":"500"'))).toBeUndefined()
  })

  // The mirror of the rename cases: a release that only ADDS fields must keep
  // parsing, so new bindings data never downgrades the fee UI on its own.
  it('ignores unknown fields the bindings may add later', () => {
    const withExtras: Record<string, unknown> = JSON.parse(FEE_SCHEDULE_JSON)
    withExtras.future_section = { whatever: 1 }
    expect(parseFeeSchedule(JSON.stringify(withExtras))?.refresh.baseFeeSats).toBe(25)
  })

  it('returns undefined when a ppm expiry entry is malformed', () => {
    expect(
      parseFeeSchedule(
        FEE_SCHEDULE_JSON.replace('"expiry_blocks_threshold":145', '"threshold":145')
      )
    ).toBeUndefined()
  })
})
