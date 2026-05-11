import type { Balance } from '@secondts/barkd'

export interface BalanceTotals {
  spendableSat: number
  pendingSat: number
  totalSat: number
}

export function getBalanceTotals(balance: Balance | undefined): BalanceTotals {
  if (!balance) {
    return { pendingSat: 0, spendableSat: 0, totalSat: 0 }
  }
  const pendingSat =
    balance.pendingBoardSat +
    balance.pendingInRoundSat +
    balance.pendingLightningSendSat +
    balance.claimableLightningReceiveSat +
    (balance.pendingExitSat ?? 0)
  return {
    pendingSat,
    spendableSat: balance.spendableSat,
    totalSat: balance.spendableSat + pendingSat
  }
}
