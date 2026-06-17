import type { Balance, OnchainBalance, UtxoInfo, WalletTxInfo } from '@secondts/barkd'

function isBalance(value: unknown): value is Balance {
  return typeof value === 'object' && value !== null && 'spendableSat' in value
}

/**
 * `pendingExitSat` is `null`/`undefined` only when the exit subsystem is
 * momentarily unavailable (e.g. while it advances an active exit), not when no
 * exit exists — an idle or completed exit returns a real `0`. Coercing the
 * unavailable case to `0` makes the total flicker by the pending-exit amount
 * between polls, so carry the last known value forward until a real number
 * arrives.
 */
export function carryForwardPendingExit(previous: unknown, next: unknown): unknown {
  if (!(isBalance(previous) && isBalance(next))) {
    return next
  }
  if (next.pendingExitSat === null || next.pendingExitSat === undefined) {
    return { ...next, pendingExitSat: previous.pendingExitSat }
  }
  return next
}

export interface BalanceTotals {
  offchainSat: number
  onchainSat: number
  onchainPendingSat: number
  exitChangePendingSat: number
  pendingBoardSat: number
  pendingInRoundSat: number
  pendingLightningSendSat: number
  claimableLightningReceiveSat: number
  pendingExitSat: number
  totalSat: number
}

export function sumUnconfirmedCpfpUtxoSat(transactions: WalletTxInfo[], utxos: UtxoInfo[]): number {
  const cpfpTxids = new Set(transactions.filter((tx) => tx.isCpfp).map((tx) => tx.txid))
  const isUnconfirmedCpfp = (utxo: UtxoInfo) =>
    (utxo.confirmationHeight === null || utxo.confirmationHeight === undefined) &&
    cpfpTxids.has(utxo.outpoint.split(':')[0])
  return utxos.filter(isUnconfirmedCpfp).reduce((total, utxo) => total + utxo.amountSat, 0)
}

export function getBalanceTotals(
  balance?: Balance,
  onchainBalance?: OnchainBalance,
  transactions: WalletTxInfo[] = [],
  utxos: UtxoInfo[] = []
): BalanceTotals {
  const onchainSat = onchainBalance?.trustedSpendableSat ?? 0
  const untrustedPendingSat = onchainBalance?.untrustedPendingSat ?? 0
  const exitChangePendingSat = Math.min(
    sumUnconfirmedCpfpUtxoSat(transactions, utxos),
    untrustedPendingSat
  )
  const onchainPendingSat = untrustedPendingSat - exitChangePendingSat
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
    exitChangePendingSat +
    pendingBoardSat +
    pendingInRoundSat +
    pendingLightningSendSat +
    claimableLightningReceiveSat +
    pendingExitSat
  return {
    claimableLightningReceiveSat,
    exitChangePendingSat,
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
