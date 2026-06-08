import type { Balance, OnchainBalance } from '@secondts/barkd'
import { describe, expect, it } from 'vitest'
import { carryForwardPendingExit, getBalanceTotals } from '../../src/utils/balance'

function makeBalance(overrides: Partial<Balance> = {}): Balance {
  return {
    claimableLightningReceiveSat: 0,
    pendingBoardSat: 0,
    pendingExitSat: null,
    pendingInRoundSat: 0,
    pendingLightningSendSat: 0,
    spendableSat: 0,
    ...overrides
  }
}

function makeOnchainBalance(overrides: Partial<OnchainBalance> = {}): OnchainBalance {
  return {
    confirmedSat: 0,
    immatureSat: 0,
    totalSat: 0,
    trustedPendingSat: 0,
    trustedSpendableSat: 0,
    untrustedPendingSat: 0,
    ...overrides
  }
}

describe(getBalanceTotals, () => {
  it('returns zeros when both balances are undefined', () => {
    expect(getBalanceTotals()).toStrictEqual({
      claimableLightningReceiveSat: 0,
      offchainSat: 0,
      onchainPendingSat: 0,
      onchainSat: 0,
      pendingBoardSat: 0,
      pendingExitSat: 0,
      pendingInRoundSat: 0,
      pendingLightningSendSat: 0,
      totalSat: 0
    })
  })

  it('returns onchain totals only when ark balance is undefined', () => {
    const onchain = makeOnchainBalance({ trustedSpendableSat: 1000, untrustedPendingSat: 200 })
    expect(getBalanceTotals(undefined, onchain)).toStrictEqual({
      claimableLightningReceiveSat: 0,
      offchainSat: 0,
      onchainPendingSat: 200,
      onchainSat: 1000,
      pendingBoardSat: 0,
      pendingExitSat: 0,
      pendingInRoundSat: 0,
      pendingLightningSendSat: 0,
      totalSat: 1200
    })
  })

  it('keeps each pending bucket separate and sums everything into totalSat', () => {
    const balance = makeBalance({
      claimableLightningReceiveSat: 50,
      pendingBoardSat: 10,
      pendingExitSat: 400,
      pendingInRoundSat: 20,
      pendingLightningSendSat: 30,
      spendableSat: 5000
    })
    const onchain = makeOnchainBalance({ trustedSpendableSat: 1000, untrustedPendingSat: 100 })
    expect(getBalanceTotals(balance, onchain)).toStrictEqual({
      claimableLightningReceiveSat: 50,
      offchainSat: 5000,
      onchainPendingSat: 100,
      onchainSat: 1000,
      pendingBoardSat: 10,
      pendingExitSat: 400,
      pendingInRoundSat: 20,
      pendingLightningSendSat: 30,
      totalSat: 5000 + 10 + 20 + 30 + 50 + 400 + 1000 + 100
    })
  })

  it('treats undefined pendingExitSat as zero', () => {
    const balance = makeBalance({ pendingExitSat: undefined, spendableSat: 100 })
    const result = getBalanceTotals(balance)
    expect(result.pendingExitSat).toBe(0)
    expect(result.totalSat).toBe(100)
  })

  it('treats null pendingExitSat as zero', () => {
    const balance = makeBalance({ pendingExitSat: null, spendableSat: 100 })
    const result = getBalanceTotals(balance)
    expect(result.pendingExitSat).toBe(0)
    expect(result.totalSat).toBe(100)
  })

  it('falls back to zero when onchain fields are absent', () => {
    const balance = makeBalance({ spendableSat: 7 })
    const onchain = makeOnchainBalance()
    const result = getBalanceTotals(balance, onchain)
    expect(result.onchainSat).toBe(0)
    expect(result.onchainPendingSat).toBe(0)
    expect(result.totalSat).toBe(7)
  })
})

describe(carryForwardPendingExit, () => {
  it('keeps the last known pending-exit amount when the subsystem reports null', () => {
    const previous = makeBalance({ pendingExitSat: 1000, spendableSat: 785 })
    const next = makeBalance({ pendingExitSat: null, spendableSat: 785 })
    expect(carryForwardPendingExit(previous, next)).toStrictEqual({
      ...next,
      pendingExitSat: 1000
    })
  })

  it('carries forward when the subsystem reports undefined', () => {
    const previous = makeBalance({ pendingExitSat: 1000, spendableSat: 785 })
    const next = makeBalance({ pendingExitSat: undefined, spendableSat: 785 })
    expect(carryForwardPendingExit(previous, next)).toStrictEqual({
      ...next,
      pendingExitSat: 1000
    })
  })

  it('clears a carried value once a real number arrives', () => {
    const previous = makeBalance({ pendingExitSat: 1000, spendableSat: 785 })
    const next = makeBalance({ pendingExitSat: 0, spendableSat: 1785 })
    expect(carryForwardPendingExit(previous, next)).toStrictEqual(next)
  })

  it('returns next unchanged when there is no previous balance', () => {
    const next = makeBalance({ pendingExitSat: null, spendableSat: 785 })
    expect(carryForwardPendingExit(undefined, next)).toBe(next)
  })
})
