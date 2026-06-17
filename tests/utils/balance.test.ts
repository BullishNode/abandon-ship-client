import type { Balance, OnchainBalance, UtxoInfo, WalletTxInfo } from '@secondts/barkd'
import { describe, expect, it } from 'vitest'
import {
  carryForwardPendingExit,
  getBalanceTotals,
  sumUnconfirmedCpfpUtxoSat
} from '../../src/utils/balance'

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

function makeTx(overrides: Partial<WalletTxInfo> = {}): WalletTxInfo {
  return {
    balanceChangeSat: 0,
    confirmation: null,
    isCpfp: false,
    onchainFeeSat: null,
    tx: '',
    txid: 'tx',
    ...overrides
  }
}

function makeUtxo(overrides: Partial<UtxoInfo> = {}): UtxoInfo {
  return {
    amountSat: 0,
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
      exitChangePendingSat: 0,
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
      exitChangePendingSat: 0,
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
    expect(result.exitChangePendingSat).toBe(0)
    expect(result.totalSat).toBe(7)
  })

  it('attributes the whole untrusted-pending bucket to exit change when all is cpfp', () => {
    const onchain = makeOnchainBalance({ untrustedPendingSat: 500 })
    const transactions = [makeTx({ isCpfp: true, txid: 'exit' })]
    const utxos = [makeUtxo({ amountSat: 500, confirmationHeight: null, outpoint: 'exit:0' })]
    const result = getBalanceTotals(undefined, onchain, transactions, utxos)
    expect(result.exitChangePendingSat).toBe(500)
    expect(result.onchainPendingSat).toBe(0)
    expect(result.totalSat).toBe(500)
  })

  it('splits the untrusted-pending bucket between exit change and external receive', () => {
    const onchain = makeOnchainBalance({ untrustedPendingSat: 800 })
    const transactions = [makeTx({ isCpfp: true, txid: 'exit' }), makeTx({ txid: 'recv' })]
    const utxos = [
      makeUtxo({ amountSat: 300, confirmationHeight: null, outpoint: 'exit:0' }),
      makeUtxo({ amountSat: 500, confirmationHeight: null, outpoint: 'recv:0' })
    ]
    const result = getBalanceTotals(undefined, onchain, transactions, utxos)
    expect(result.exitChangePendingSat).toBe(300)
    expect(result.onchainPendingSat).toBe(500)
    expect(result.totalSat).toBe(800)
  })

  it('keeps the full amount as plain pending when transaction data is missing', () => {
    const onchain = makeOnchainBalance({ untrustedPendingSat: 400 })
    const result = getBalanceTotals(undefined, onchain)
    expect(result.exitChangePendingSat).toBe(0)
    expect(result.onchainPendingSat).toBe(400)
  })

  it('clamps exit change to the untrusted-pending bucket', () => {
    const onchain = makeOnchainBalance({ untrustedPendingSat: 200 })
    const transactions = [makeTx({ isCpfp: true, txid: 'exit' })]
    const utxos = [makeUtxo({ amountSat: 1000, confirmationHeight: null, outpoint: 'exit:0' })]
    const result = getBalanceTotals(undefined, onchain, transactions, utxos)
    expect(result.exitChangePendingSat).toBe(200)
    expect(result.onchainPendingSat).toBe(0)
  })
})

describe(sumUnconfirmedCpfpUtxoSat, () => {
  it('sums only unconfirmed utxos sourced from cpfp transactions', () => {
    const transactions = [makeTx({ isCpfp: true, txid: 'exit' }), makeTx({ txid: 'recv' })]
    const utxos = [
      makeUtxo({ amountSat: 300, confirmationHeight: null, outpoint: 'exit:0' }),
      makeUtxo({ amountSat: 999, confirmationHeight: null, outpoint: 'recv:0' })
    ]
    expect(sumUnconfirmedCpfpUtxoSat(transactions, utxos)).toBe(300)
  })

  it('ignores confirmed cpfp utxos', () => {
    const transactions = [makeTx({ isCpfp: true, txid: 'exit' })]
    const utxos = [makeUtxo({ amountSat: 300, confirmationHeight: 800_000, outpoint: 'exit:0' })]
    expect(sumUnconfirmedCpfpUtxoSat(transactions, utxos)).toBe(0)
  })

  it('returns zero when there are no cpfp transactions', () => {
    const transactions = [makeTx({ txid: 'recv' })]
    const utxos = [makeUtxo({ amountSat: 300, confirmationHeight: null, outpoint: 'recv:0' })]
    expect(sumUnconfirmedCpfpUtxoSat(transactions, utxos)).toBe(0)
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
