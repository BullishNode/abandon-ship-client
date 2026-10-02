import { describe, expect, it } from 'vitest'
import { BalanceFromJSON, EmergencyExitFeeEstimateResponseFromJSON } from '@secondts/barkd'
import type { EmergencyExitFeeEstimateResponse } from '@secondts/barkd'
import { toBalance, toEmergencyExitFeeEstimate } from '@/lib/backend/barkd/map'
import { getBalanceTotals } from '@/utils/balance'

describe(toBalance, () => {
  // The shape barkd master (6768e0fb4) returns, with an expired coin.
  const masterJson = {
    claimable_lightning_receive_sat: 0,
    needs_refresh_sat: 1_024_424,
    pending_arkoor_send_sat: 3000,
    pending_board_sat: 0,
    pending_exit_sat: 0,
    pending_in_round_sat: 0,
    pending_lightning_send_sat: 0,
    pending_offboard_sat: 9000,
    spendable_sat: 0
  }

  it('reads the master-only fields the 0.7.2 client model drops', () => {
    const balance = toBalance(BalanceFromJSON(masterJson), masterJson)
    expect(balance.needsRefreshSats).toBe(1_024_424)
    expect(balance.pendingArkoorSendSats).toBe(3000)
    expect(balance.pendingOffboardSats).toBe(9000)
  })

  it('keeps expired coins in the total', () => {
    const balance = toBalance(BalanceFromJSON(masterJson), masterJson)
    expect(getBalanceTotals(balance).totalSat).toBe(1_036_424)
  })

  it('reads the new fields as 0 when an older barkd omits them', () => {
    const json = { ...masterJson }
    delete (json as Partial<typeof json>).needs_refresh_sat
    const balance = toBalance(BalanceFromJSON(json), json)
    expect(balance.needsRefreshSats).toBe(0)
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

  it('leaves fundable undefined when barkd master omits it', () => {
    const dto = EmergencyExitFeeEstimateResponseFromJSON({
      claim_fee_sat: 150,
      exit_broadcast_fee_sat: 2400,
      fee_rate_sat_per_vb: 12,
      total_fee_sat: 2550,
      txs_to_broadcast: 3
    })
    expect(toEmergencyExitFeeEstimate(dto).fundable).toBeUndefined()
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
