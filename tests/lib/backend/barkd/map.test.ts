import { describe, expect, it } from 'vitest'
import type { EmergencyExitFeeEstimateResponse } from '@secondts/barkd'
import { toEmergencyExitFeeEstimate } from '@/lib/backend/barkd/map'

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
