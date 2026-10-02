import { describe, expect, it } from 'vitest'
import { isExitFundable } from '@/components/emergency-exit-start-dialog'

const estimate = { estimatedFeeSat: 2601, feeRateSatPerVb: 2, onchainSat: 0, vtxoCount: 1 }

describe(isExitFundable, () => {
  it('trusts the backend flag when there is one', () => {
    expect(isExitFundable({ ...estimate, fundable: false, onchainSat: 48_569_535 })).toBeFalsy()
    expect(isExitFundable({ ...estimate, fundable: true })).toBeTruthy()
  })

  it('compares the fee with the on-chain balance when the flag is missing', () => {
    expect(isExitFundable({ ...estimate, onchainSat: 48_569_535 })).toBeTruthy()
    expect(isExitFundable({ ...estimate, onchainSat: 2600 })).toBeFalsy()
  })
})
