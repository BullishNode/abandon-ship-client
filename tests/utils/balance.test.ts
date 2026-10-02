import { describe, expect, it } from 'vitest'
import {
  carryForwardPendingExit,
  getBalanceTotals,
  sumUnconfirmedCpfpUtxoSat
} from '../../src/utils/balance'
import type { Balance, OnchainBalance } from '@/types/domain/balance'
import type { Utxo, WalletTx } from '@/types/domain/onchain'

function makeBalance(overrides: Partial<Balance> = {}): Balance {
  return {
    claimableLightningReceiveSats: 0,
    pendingBoardSats: 0,
    pendingExitSats: null,
    pendingInRoundSats: 0,
    pendingLightningSendSats: 0,
    spendableSats: 0,
    ...overrides
  }
}

function makeOnchainBalance(overrides: Partial<OnchainBalance> = {}): OnchainBalance {
  return {
    confirmedSats: 0,
    immatureSats: 0,
    totalSats: 0,
    trustedPendingSats: 0,
    trustedSpendableSats: 0,
    untrustedPendingSats: 0,
    ...overrides
  }
}

function makeTx(overrides: Partial<WalletTx> = {}): WalletTx {
  return {
    balanceChangeSats: 0,
    confirmation: null,
    isCpfp: false,
    onchainFeeSats: null,
    tx: '',
    txid: 'tx',
    ...overrides
  }
}

function makeUtxo(overrides: Partial<Utxo> = {}): Utxo {
  return {
    amountSats: 0,
    confirmationHeight: null,
    outpoint: 'tx:0',
    ...overrides
  }
}

describe(getBalanceTotals, () => {
  it('returns zeros when both balances are undefined', () => {
    expect(getBalanceTotals()).toStrictEqual({
      claimableLightningReceiveSat: 0,
      exitChangePendingSat: 0,
      needsRefreshSat: 0,
      offchainSat: 0,
      onchainPendingSat: 0,
      onchainSat: 0,
      payingOutSat: 0,
      pendingArkoorSendSat: 0,
      pendingBoardSat: 0,
      pendingExitSat: 0,
      pendingInRoundSat: 0,
      pendingLightningSendSat: 0,
      pendingOffboardSat: 0,
      totalSat: 0
    })
  })

  it('returns onchain totals only when ark balance is undefined', () => {
    const onchain = makeOnchainBalance({ trustedSpendableSats: 1000, untrustedPendingSats: 200 })
    expect(getBalanceTotals(undefined, onchain)).toStrictEqual({
      claimableLightningReceiveSat: 0,
      exitChangePendingSat: 0,
      needsRefreshSat: 0,
      offchainSat: 0,
      onchainPendingSat: 200,
      onchainSat: 1000,
      payingOutSat: 0,
      pendingArkoorSendSat: 0,
      pendingBoardSat: 0,
      pendingExitSat: 0,
      pendingInRoundSat: 0,
      pendingLightningSendSat: 0,
      pendingOffboardSat: 0,
      totalSat: 1200
    })
  })

  it('keeps each pending bucket separate and sums everything into totalSat', () => {
    const balance = makeBalance({
      claimableLightningReceiveSats: 50,
      needsRefreshSats: 60,
      pendingArkoorSendSats: 70,
      pendingBoardSats: 10,
      pendingExitSats: 400,
      pendingInRoundSats: 20,
      pendingLightningSendSats: 30,
      pendingOffboardSats: 80,
      spendableSats: 5000
    })
    const onchain = makeOnchainBalance({ trustedSpendableSats: 1000, untrustedPendingSats: 100 })
    expect(getBalanceTotals(balance, onchain)).toStrictEqual({
      claimableLightningReceiveSat: 50,
      exitChangePendingSat: 0,
      needsRefreshSat: 60,
      offchainSat: 5000,
      onchainPendingSat: 100,
      onchainSat: 1000,
      payingOutSat: 0,
      pendingArkoorSendSat: 70,
      pendingBoardSat: 10,
      pendingExitSat: 400,
      pendingInRoundSat: 20,
      pendingLightningSendSat: 30,
      pendingOffboardSat: 80,
      totalSat: 5000 + 10 + 20 + 30 + 50 + 400 + 1000 + 100 + 60 + 70 + 80
    })
  })

  it('counts expired coins paying out on-chain in the total', () => {
    const totals = getBalanceTotals(makeBalance({ spendableSats: 100 }), undefined, [], [], 900)
    expect(totals.payingOutSat).toBe(900)
    expect(totals.totalSat).toBe(1000)
  })

  it('treats undefined pendingExitSat as zero', () => {
    const balance = makeBalance({ pendingExitSats: undefined, spendableSats: 100 })
    const result = getBalanceTotals(balance)
    expect(result.pendingExitSat).toBe(0)
    expect(result.totalSat).toBe(100)
  })

  it('treats null pendingExitSat as zero', () => {
    const balance = makeBalance({ pendingExitSats: null, spendableSats: 100 })
    const result = getBalanceTotals(balance)
    expect(result.pendingExitSat).toBe(0)
    expect(result.totalSat).toBe(100)
  })

  it('falls back to zero when onchain fields are absent', () => {
    const balance = makeBalance({ spendableSats: 7 })
    const onchain = makeOnchainBalance()
    const result = getBalanceTotals(balance, onchain)
    expect(result.onchainSat).toBe(0)
    expect(result.onchainPendingSat).toBe(0)
    expect(result.exitChangePendingSat).toBe(0)
    expect(result.totalSat).toBe(7)
  })

  it('attributes the whole untrusted-pending bucket to exit change when all is cpfp', () => {
    const onchain = makeOnchainBalance({ untrustedPendingSats: 500 })
    const transactions = [makeTx({ isCpfp: true, txid: 'exit' })]
    const utxos = [makeUtxo({ amountSats: 500, confirmationHeight: null, outpoint: 'exit:0' })]
    const result = getBalanceTotals(undefined, onchain, transactions, utxos)
    expect(result.exitChangePendingSat).toBe(500)
    expect(result.onchainPendingSat).toBe(0)
    expect(result.totalSat).toBe(500)
  })

  it('splits the untrusted-pending bucket between exit change and external receive', () => {
    const onchain = makeOnchainBalance({ untrustedPendingSats: 800 })
    const transactions = [makeTx({ isCpfp: true, txid: 'exit' }), makeTx({ txid: 'recv' })]
    const utxos = [
      makeUtxo({ amountSats: 300, confirmationHeight: null, outpoint: 'exit:0' }),
      makeUtxo({ amountSats: 500, confirmationHeight: null, outpoint: 'recv:0' })
    ]
    const result = getBalanceTotals(undefined, onchain, transactions, utxos)
    expect(result.exitChangePendingSat).toBe(300)
    expect(result.onchainPendingSat).toBe(500)
    expect(result.totalSat).toBe(800)
  })

  it('keeps the full amount as plain pending when transaction data is missing', () => {
    const onchain = makeOnchainBalance({ untrustedPendingSats: 400 })
    const result = getBalanceTotals(undefined, onchain)
    expect(result.exitChangePendingSat).toBe(0)
    expect(result.onchainPendingSat).toBe(400)
  })

  it('clamps exit change to the untrusted-pending bucket', () => {
    const onchain = makeOnchainBalance({ untrustedPendingSats: 200 })
    const transactions = [makeTx({ isCpfp: true, txid: 'exit' })]
    const utxos = [makeUtxo({ amountSats: 1000, confirmationHeight: null, outpoint: 'exit:0' })]
    const result = getBalanceTotals(undefined, onchain, transactions, utxos)
    expect(result.exitChangePendingSat).toBe(200)
    expect(result.onchainPendingSat).toBe(0)
  })
})

describe(sumUnconfirmedCpfpUtxoSat, () => {
  it('sums only unconfirmed utxos sourced from cpfp transactions', () => {
    const transactions = [makeTx({ isCpfp: true, txid: 'exit' }), makeTx({ txid: 'recv' })]
    const utxos = [
      makeUtxo({ amountSats: 300, confirmationHeight: null, outpoint: 'exit:0' }),
      makeUtxo({ amountSats: 999, confirmationHeight: null, outpoint: 'recv:0' })
    ]
    expect(sumUnconfirmedCpfpUtxoSat(transactions, utxos)).toBe(300)
  })

  it('ignores confirmed cpfp utxos', () => {
    const transactions = [makeTx({ isCpfp: true, txid: 'exit' })]
    const utxos = [makeUtxo({ amountSats: 300, confirmationHeight: 800_000, outpoint: 'exit:0' })]
    expect(sumUnconfirmedCpfpUtxoSat(transactions, utxos)).toBe(0)
  })

  it('returns zero when there are no cpfp transactions', () => {
    const transactions = [makeTx({ txid: 'recv' })]
    const utxos = [makeUtxo({ amountSats: 300, confirmationHeight: null, outpoint: 'recv:0' })]
    expect(sumUnconfirmedCpfpUtxoSat(transactions, utxos)).toBe(0)
  })
})

describe(carryForwardPendingExit, () => {
  it('keeps the last known pending-exit amount when the subsystem reports null', () => {
    const previous = makeBalance({ pendingExitSats: 1000, spendableSats: 785 })
    const next = makeBalance({ pendingExitSats: null, spendableSats: 785 })
    expect(carryForwardPendingExit(previous, next)).toStrictEqual({
      ...next,
      pendingExitSats: 1000
    })
  })

  it('carries forward when the subsystem reports undefined', () => {
    const previous = makeBalance({ pendingExitSats: 1000, spendableSats: 785 })
    const next = makeBalance({ pendingExitSats: undefined, spendableSats: 785 })
    expect(carryForwardPendingExit(previous, next)).toStrictEqual({
      ...next,
      pendingExitSats: 1000
    })
  })

  it('clears a carried value once a real number arrives', () => {
    const previous = makeBalance({ pendingExitSats: 1000, spendableSats: 785 })
    const next = makeBalance({ pendingExitSats: 0, spendableSats: 1785 })
    expect(carryForwardPendingExit(previous, next)).toStrictEqual(next)
  })

  it('returns next unchanged when there is no previous balance', () => {
    const next = makeBalance({ pendingExitSats: null, spendableSats: 785 })
    expect(carryForwardPendingExit(undefined, next)).toBe(next)
  })
})
