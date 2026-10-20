import { describe, expect, it } from 'vitest'
import type { Balance as BarkdBalance, EmergencyExitFeeEstimateResponse } from '@secondts/barkd'
import { toBalance, toEmergencyExitFeeEstimate } from '@/lib/backend/barkd/map'

describe(toBalance, () => {
  const dto: BarkdBalance = {
    claimableLightningReceiveSat: 7,
    pendingBoardSat: 11,
    pendingExitSat: 13,
    pendingInRoundSat: 17,
    pendingLightningSendSat: 19,
    spendableSat: 23
  }

  it('preserves each native category without increasing spendable value', () => {
    expect(
      toBalance(dto, {
        awaiting_settlement_sat: 29,
        needs_refresh_sat: 31,
        pending_arkoor_send_sat: 37,
        pending_offboard_sat: 41
      })
    ).toStrictEqual({
      awaitingSettlementSats: 29,
      claimableLightningReceiveSats: 7,
      needsRefreshSats: 31,
      pendingArkoorSendSats: 37,
      pendingBoardSats: 11,
      pendingExitSats: 13,
      pendingInRoundSats: 17,
      pendingLightningSendSats: 19,
      pendingOffboardSats: 41,
      spendableSats: 23
    })
  })

  it('defaults omitted native categories to zero for older backends', () => {
    expect(toBalance(dto)).toStrictEqual({
      awaitingSettlementSats: 0,
      claimableLightningReceiveSats: 7,
      needsRefreshSats: 0,
      pendingArkoorSendSats: 0,
      pendingBoardSats: 11,
      pendingExitSats: 13,
      pendingInRoundSats: 17,
      pendingLightningSendSats: 19,
      pendingOffboardSats: 0,
      spendableSats: 23
    })
  })

  it.each([
    ['awaiting_settlement_sat', 'awaitingSettlementSats'],
    ['needs_refresh_sat', 'needsRefreshSats'],
    ['pending_arkoor_send_sat', 'pendingArkoorSendSats'],
    ['pending_offboard_sat', 'pendingOffboardSats']
  ] as const)('defaults omitted %s to zero without discarding other categories', (rawKey, key) => {
    const raw: Record<string, number> = {
      awaiting_settlement_sat: 29,
      needs_refresh_sat: 31,
      pending_arkoor_send_sat: 37,
      pending_offboard_sat: 41
    }
    delete raw[rawKey]
    expect(toBalance(dto, raw)).toStrictEqual({
      awaitingSettlementSats: 29,
      claimableLightningReceiveSats: 7,
      needsRefreshSats: 31,
      pendingArkoorSendSats: 37,
      pendingBoardSats: 11,
      pendingExitSats: 13,
      pendingInRoundSats: 17,
      pendingLightningSendSats: 19,
      pendingOffboardSats: 41,
      spendableSats: 23,
      [key]: 0
    })
  })

  it.each([
    'awaiting_settlement_sat',
    'needs_refresh_sat',
    'pending_arkoor_send_sat',
    'pending_offboard_sat'
  ])('rejects negative and fractional %s in the production raw parser', (key) => {
    expect(() => toBalance(dto, { [key]: -1 })).toThrow()
    expect(() => toBalance(dto, { [key]: 1.5 })).toThrow()
  })
})

describe(toEmergencyExitFeeEstimate, () => {
  it('maps every field from the *_sat names and preserves fundable: false', () => {
    const dto: EmergencyExitFeeEstimateResponse = {
      claimFeeSat: 150,
      exitBroadcastFeeSat: 2400,
      feeRateSatPerVb: 12,
      fundable: false,
      totalFeeSat: 2550,
      txsToBroadcast: 3
    }
    expect(toEmergencyExitFeeEstimate(dto)).toStrictEqual({
      claimFeeSats: 150,
      exitBroadcastFeeSats: 2400,
      feeRateSatPerVb: 12,
      fundable: false,
      totalFeeSats: 2550,
      txsToBroadcast: 3
    })
  })

  it('preserves fundable: true', () => {
    const dto: EmergencyExitFeeEstimateResponse = {
      claimFeeSat: 0,
      exitBroadcastFeeSat: 0,
      feeRateSatPerVb: 1,
      fundable: true,
      totalFeeSat: 0,
      txsToBroadcast: 0
    }
    expect(toEmergencyExitFeeEstimate(dto).fundable).toBeTruthy()
  })
})
