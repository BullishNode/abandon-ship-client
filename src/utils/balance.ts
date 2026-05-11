import type { Balance, OnchainBalance } from '@secondts/barkd'

export interface BalanceTotals {
  spendableSat: number
  pendingSat: number
  onchainSat: number
  onchainPendingSat: number
  totalSat: number
}

export function getBalanceTotals(
  balance: Balance | undefined,
  onchainBalance: OnchainBalance | undefined
): BalanceTotals {
  const onchainSat = onchainBalance?.trustedSpendableSat ?? 0
  const onchainPendingSat = onchainBalance?.untrustedPendingSat ?? 0
  if (!balance) {
    return {
      onchainPendingSat,
      onchainSat,
      pendingSat: 0,
      spendableSat: 0,
      totalSat: onchainSat + onchainPendingSat
    }
  }
  const pendingSat =
    balance.pendingBoardSat +
    balance.pendingInRoundSat +
    balance.pendingLightningSendSat +
    balance.claimableLightningReceiveSat +
    (balance.pendingExitSat ?? 0)
  return {
    onchainPendingSat,
    onchainSat,
    pendingSat,
    spendableSat: balance.spendableSat,
    totalSat: balance.spendableSat + pendingSat + onchainSat + onchainPendingSat
  }
}
