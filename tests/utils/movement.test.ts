import { describe, expect, it } from 'vitest'
import {
  getMovementCounterparty,
  getMovementDirection,
  getMovementFeeSat,
  getMovementSource,
  isArkToOnchainTransfer,
  isOffboardSubsystem,
  sumExitCpfpFeeSat
} from '../../src/utils/movement'
import { createMovement } from '../fixtures/movements'
import type { WalletTx } from '@/types/domain/onchain'

function createWalletTx(overrides: Partial<WalletTx> = {}): WalletTx {
  return {
    balanceChangeSats: 0,
    isCpfp: false,
    onchainFeeSats: null,
    tx: '00',
    txid: 'tx',
    ...overrides
  }
}

const EXIT_SUBSYSTEM = { kind: 'exit', name: 'bark.exit' } as const

describe(getMovementDirection, () => {
  it('returns incoming for positive balance', () => {
    const movement = createMovement({ effectiveBalanceSats: 50_000 })
    expect(getMovementDirection(movement)).toBe('incoming')
  })

  it('returns incoming for zero balance', () => {
    const movement = createMovement({ effectiveBalanceSats: 0 })
    expect(getMovementDirection(movement)).toBe('incoming')
  })

  it('returns outgoing for negative balance', () => {
    const movement = createMovement({ effectiveBalanceSats: -10_000 })
    expect(getMovementDirection(movement)).toBe('outgoing')
  })
})

describe(getMovementCounterparty, () => {
  it('returns formatted sentTo address for outgoing movement', () => {
    const movement = createMovement({
      effectiveBalanceSats: -50_000,
      sentTo: [
        {
          amountSats: 50_000,
          paymentType: 'bitcoin',
          value: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
        }
      ]
    })
    expect(getMovementCounterparty(movement)).toBe('bc1qar0...zwf5mdq')
  })

  it('returns formatted receivedOn address for incoming movement', () => {
    const movement = createMovement({
      effectiveBalanceSats: 50_000,
      receivedOn: [
        {
          amountSats: 50_000,
          paymentType: 'invoice',
          value: 'lnbc1pvjluezpp5qqqsyqcyq5rqwzqf'
        }
      ]
    })
    expect(getMovementCounterparty(movement)).toBe('lnbc1pv...5rqwzqf')
  })

  it('returns subsystem name when outgoing has no sentTo', () => {
    const movement = createMovement({
      effectiveBalanceSats: -10_000,
      sentTo: [],
      subsystem: { kind: 'lightning', name: 'Lightning' }
    })
    expect(getMovementCounterparty(movement)).toBe('Lightning')
  })

  it('returns subsystem name when incoming has no receivedOn', () => {
    const movement = createMovement({
      effectiveBalanceSats: 10_000,
      receivedOn: [],
      subsystem: { kind: 'ark', name: 'Ark' }
    })
    expect(getMovementCounterparty(movement)).toBe('Ark')
  })
})

describe(getMovementSource, () => {
  it('returns ark when a destination has type ark', () => {
    const movement = createMovement({
      sentTo: [{ amountSats: 1, paymentType: 'ark', value: 'ark1abc' }]
    })
    expect(getMovementSource(movement)).toBe('ark')
  })

  it('returns onchain when a destination has type bitcoin', () => {
    const movement = createMovement({
      sentTo: [{ amountSats: 1, paymentType: 'bitcoin', value: 'bc1qabc' }]
    })
    expect(getMovementSource(movement)).toBe('onchain')
  })

  it('returns onchain when a destination has type output-script', () => {
    const movement = createMovement({
      sentTo: [{ amountSats: 1, paymentType: 'output-script', value: '00' }]
    })
    expect(getMovementSource(movement)).toBe('onchain')
  })

  it('returns lightning for invoice/offer/lightning-address destinations', () => {
    const invoice = createMovement({
      sentTo: [{ amountSats: 1, paymentType: 'invoice', value: 'lnbc1' }]
    })
    const offer = createMovement({
      sentTo: [{ amountSats: 1, paymentType: 'offer', value: 'lno1' }]
    })
    const lnaddr = createMovement({
      sentTo: [{ amountSats: 1, paymentType: 'lightning-address', value: 'a@b' }]
    })
    expect(getMovementSource(invoice)).toBe('lightning')
    expect(getMovementSource(offer)).toBe('lightning')
    expect(getMovementSource(lnaddr)).toBe('lightning')
  })

  it('falls back to subsystem name when destinations are absent or custom', () => {
    const ln = createMovement({ subsystem: { kind: 'lightning', name: 'Lightning' } })
    const onchain = createMovement({ subsystem: { kind: 'onchain', name: 'on-chain wallet' } })
    const ark = createMovement({ subsystem: { kind: 'ark', name: 'Ark' } })
    expect(getMovementSource(ln)).toBe('lightning')
    expect(getMovementSource(onchain)).toBe('onchain')
    expect(getMovementSource(ark)).toBe('ark')
  })

  it('matches subsystem name "ln" as lightning', () => {
    const movement = createMovement({ subsystem: { kind: 'lightning', name: 'ln' } })
    expect(getMovementSource(movement)).toBe('lightning')
  })

  it('returns unknown when nothing matches', () => {
    const movement = createMovement({ subsystem: { kind: 'custom', name: 'mystery' } })
    expect(getMovementSource(movement)).toBe('unknown')
  })

  it('prefers destination type over subsystem name', () => {
    const movement = createMovement({
      receivedOn: [{ amountSats: 1, paymentType: 'invoice', value: 'lnbc' }],
      subsystem: { kind: 'ark', name: 'Ark' }
    })
    expect(getMovementSource(movement)).toBe('lightning')
  })

  it('classifies a bark.offboard with a bitcoin destination as onchain', () => {
    const movement = createMovement({
      sentTo: [{ amountSats: 5000, paymentType: 'bitcoin', value: 'tb1p9lwzpy' }],
      subsystem: { kind: 'send_onchain', name: 'bark.offboard' }
    })
    expect(getMovementSource(movement)).toBe('onchain')
  })

  it('falls back to ark for a bark.offboard whose destination type is unrecognized', () => {
    const movement = createMovement({
      sentTo: [{ amountSats: 5000, paymentType: 'custom', value: 'x' }],
      subsystem: { kind: 'send_onchain', name: 'bark.offboard' }
    })
    expect(getMovementSource(movement)).toBe('ark')
  })

  it('classifies bark.exit as exit even with bitcoin destination', () => {
    const movement = createMovement({
      sentTo: [{ amountSats: 5000, paymentType: 'bitcoin', value: 'tb1p9lwzpy' }],
      subsystem: { kind: 'exit', name: 'bark.exit' }
    })
    expect(getMovementSource(movement)).toBe('exit')
  })

  it('classifies a refresh movement as refresh', () => {
    const movement = createMovement({
      subsystem: { kind: 'refresh', name: 'bark.round' }
    })
    expect(getMovementSource(movement)).toBe('refresh')
  })
})

describe(isOffboardSubsystem, () => {
  it('matches bark.offboard regardless of kind', () => {
    expect(isOffboardSubsystem({ kind: 'send_onchain', name: 'bark.offboard' })).toBeTruthy()
    expect(isOffboardSubsystem({ kind: 'offboard', name: 'bark.offboard' })).toBeTruthy()
  })

  it('matches bark.round only for offboard/send_onchain kinds', () => {
    expect(isOffboardSubsystem({ kind: 'offboard', name: 'bark.round' })).toBeTruthy()
    expect(isOffboardSubsystem({ kind: 'send_onchain', name: 'bark.round' })).toBeTruthy()
    expect(isOffboardSubsystem({ kind: 'refresh', name: 'bark.round' })).toBeFalsy()
  })

  it('does not match exits or unrelated subsystems', () => {
    expect(isOffboardSubsystem({ kind: 'exit', name: 'bark.exit' })).toBeFalsy()
    expect(isOffboardSubsystem({ kind: 'send', name: 'bark.arkoor' })).toBeFalsy()
  })
})

describe(isArkToOnchainTransfer, () => {
  it('matches both exits and offboards', () => {
    expect(isArkToOnchainTransfer({ kind: 'exit', name: 'bark.exit' })).toBeTruthy()
    expect(isArkToOnchainTransfer({ kind: 'send_onchain', name: 'bark.offboard' })).toBeTruthy()
    expect(isArkToOnchainTransfer({ kind: 'send_onchain', name: 'bark.round' })).toBeTruthy()
  })

  it('does not match ark or lightning movements', () => {
    expect(isArkToOnchainTransfer({ kind: 'send', name: 'bark.arkoor' })).toBeFalsy()
    expect(isArkToOnchainTransfer({ kind: 'refresh', name: 'bark.round' })).toBeFalsy()
    expect(isArkToOnchainTransfer({ kind: 'send', name: 'bark.lightning_send' })).toBeFalsy()
  })
})

describe(getMovementFeeSat, () => {
  it('returns the offchainFeeSat when present', () => {
    expect(getMovementFeeSat(createMovement({ offchainFeeSats: 250 }))).toBe(250)
  })

  it('returns zero when fee is zero', () => {
    expect(getMovementFeeSat(createMovement({ offchainFeeSats: 0 }))).toBe(0)
  })

  it('ignores transactions for non-exit movements', () => {
    const movement = createMovement({ offchainFeeSats: 250 })
    const transactions = [createWalletTx({ isCpfp: true, onchainFeeSats: 573 })]
    expect(getMovementFeeSat(movement, transactions)).toBe(250)
  })

  it('adds CPFP on-chain fees to an exit movement', () => {
    const movement = createMovement({ offchainFeeSats: 0, subsystem: EXIT_SUBSYSTEM })
    const transactions = [
      createWalletTx({ isCpfp: true, onchainFeeSats: 573, txid: 'a' }),
      createWalletTx({ isCpfp: true, onchainFeeSats: 642, txid: 'b' }),
      createWalletTx({ isCpfp: false, onchainFeeSats: 9999, txid: 'c' })
    ]
    expect(getMovementFeeSat(movement, transactions)).toBe(1215)
  })

  it('returns zero on-chain fee for an exit with no CPFP transactions yet', () => {
    const movement = createMovement({ offchainFeeSats: 0, subsystem: EXIT_SUBSYSTEM })
    expect(getMovementFeeSat(movement, [])).toBe(0)
  })
})

describe(sumExitCpfpFeeSat, () => {
  it('sums onchainFeeSat across CPFP transactions only', () => {
    const transactions = [
      createWalletTx({ isCpfp: true, onchainFeeSats: 573 }),
      createWalletTx({ isCpfp: true, onchainFeeSats: 642 }),
      createWalletTx({ isCpfp: false, onchainFeeSats: 100 })
    ]
    expect(sumExitCpfpFeeSat(transactions)).toBe(1215)
  })

  it('skips CPFP transactions whose fee is not yet known', () => {
    const transactions = [
      createWalletTx({ isCpfp: true, onchainFeeSats: 573 }),
      createWalletTx({ isCpfp: true, onchainFeeSats: null })
    ]
    expect(sumExitCpfpFeeSat(transactions)).toBe(573)
  })

  it('grows as more tree levels confirm', () => {
    const firstLevel = [createWalletTx({ isCpfp: true, onchainFeeSats: 573 })]
    const bothLevels = [...firstLevel, createWalletTx({ isCpfp: true, onchainFeeSats: 642 })]
    expect(sumExitCpfpFeeSat(firstLevel)).toBe(573)
    expect(sumExitCpfpFeeSat(bothLevels)).toBe(1215)
  })

  it('returns zero for an empty list', () => {
    expect(sumExitCpfpFeeSat([])).toBe(0)
  })
})
