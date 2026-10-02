import type { Balance, OnchainBalance } from '@/types/domain/balance'
import type { Utxo, WalletTx } from '@/types/domain/onchain'

function isBalance(value: unknown): value is Balance {
  return typeof value === 'object' && value !== null && 'spendableSats' in value
}

/**
 * `pendingExitSats` is `null`/`undefined` only when the exit subsystem is
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
  if (next.pendingExitSats === null || next.pendingExitSats === undefined) {
    return { ...next, pendingExitSats: previous.pendingExitSats }
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
  needsRefreshSat: number
  pendingArkoorSendSat: number
  pendingOffboardSat: number
  totalSat: number
}

export function sumUnconfirmedCpfpUtxoSat(transactions: WalletTx[], utxos: Utxo[]): number {
  const cpfpTxids = new Set(transactions.filter((tx) => tx.isCpfp).map((tx) => tx.txid))
  return utxos
    .filter(
      (utxo) =>
        (utxo.confirmationHeight === null || utxo.confirmationHeight === undefined) &&
        cpfpTxids.has(utxo.outpoint.split(':')[0])
    )
    .reduce((total, utxo) => total + utxo.amountSats, 0)
}

export function getBalanceTotals(
  balance?: Balance,
  onchainBalance?: OnchainBalance,
  transactions: WalletTx[] = [],
  utxos: Utxo[] = []
): BalanceTotals {
  const onchainSat = onchainBalance?.trustedSpendableSats ?? 0
  const untrustedPendingSat = onchainBalance?.untrustedPendingSats ?? 0
  const exitChangePendingSat = Math.min(
    sumUnconfirmedCpfpUtxoSat(transactions, utxos),
    untrustedPendingSat
  )
  const onchainPendingSat = untrustedPendingSat - exitChangePendingSat
  const offchainSat = balance?.spendableSats ?? 0
  const pendingBoardSat = balance?.pendingBoardSats ?? 0
  const pendingInRoundSat = balance?.pendingInRoundSats ?? 0
  const pendingLightningSendSat = balance?.pendingLightningSendSats ?? 0
  const claimableLightningReceiveSat = balance?.claimableLightningReceiveSats ?? 0
  const pendingExitSat = balance?.pendingExitSats ?? 0
  const needsRefreshSat = balance?.needsRefreshSats ?? 0
  const pendingArkoorSendSat = balance?.pendingArkoorSendSats ?? 0
  const pendingOffboardSat = balance?.pendingOffboardSats ?? 0
  const totalSat =
    offchainSat +
    onchainSat +
    onchainPendingSat +
    exitChangePendingSat +
    pendingBoardSat +
    pendingInRoundSat +
    pendingLightningSendSat +
    claimableLightningReceiveSat +
    pendingExitSat +
    needsRefreshSat +
    pendingArkoorSendSat +
    pendingOffboardSat
  return {
    claimableLightningReceiveSat,
    exitChangePendingSat,
    needsRefreshSat,
    offchainSat,
    onchainPendingSat,
    onchainSat,
    pendingArkoorSendSat,
    pendingBoardSat,
    pendingExitSat,
    pendingInRoundSat,
    pendingLightningSendSat,
    pendingOffboardSat,
    totalSat
  }
}
