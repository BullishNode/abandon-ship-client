import type { Balance, OnchainBalance } from '@secondts/barkd'

export interface BalanceTotals {
  offchainSat: number
  onchainSat: number
  onchainPendingSat: number
  pendingBoardSat: number
  pendingInRoundSat: number
  pendingLightningSendSat: number
  claimableLightningReceiveSat: number
  pendingExitSat: number
  totalSat: number
}

export function getBalanceTotals(
  balance?: Balance,
  onchainBalance?: OnchainBalance
): BalanceTotals {
  const onchainSat = onchainBalance?.trustedSpendableSat ?? 0
  const onchainPendingSat = onchainBalance?.untrustedPendingSat ?? 0
  const offchainSat = balance?.spendableSat ?? 0
  const pendingBoardSat = balance?.pendingBoardSat ?? 0
  const pendingInRoundSat = balance?.pendingInRoundSat ?? 0
  const pendingLightningSendSat = balance?.pendingLightningSendSat ?? 0
  const claimableLightningReceiveSat = balance?.claimableLightningReceiveSat ?? 0
  const pendingExitSat = balance?.pendingExitSat ?? 0
  const totalSat =
    offchainSat +
    onchainSat +
    onchainPendingSat +
    pendingBoardSat +
    pendingInRoundSat +
    pendingLightningSendSat +
    claimableLightningReceiveSat +
    pendingExitSat
  return {
    claimableLightningReceiveSat,
    offchainSat,
    onchainPendingSat,
    onchainSat,
    pendingBoardSat,
    pendingExitSat,
    pendingInRoundSat,
    pendingLightningSendSat,
    totalSat
  }
}
