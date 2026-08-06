import { describe, expect, it } from 'vitest'
import type {
  ArkInfo as WasmArkInfo,
  ExitState as WasmExitState,
  FeeSchedule as WasmFeeSchedule,
  Movement as WasmMovement,
  OnchainUtxo as WasmOnchainUtxo,
  Vtxo as WasmVtxo,
  VtxoState as WasmVtxoState,
  WalletTransaction as WasmWalletTransaction
} from '@secondts/bark'
import {
  toArkInfo,
  toExitStatus,
  toMovement,
  toOffboardTxid,
  toOnchainFeeRates,
  toUtxos,
  toVtxo,
  toWalletTx
} from '@/lib/backend/wasm/map'
import { getRefreshThresholdOptions } from '@/utils/refresh'

const TIP_HEIGHT = 900
const BLOCK = { hash: 'b'.repeat(64), height: 890 }

function exitStatus(state: WasmExitState) {
  return toExitStatus({ amountSats: 1000, isClaimable: false, state, vtxoId: 'vtxo-1' })
}

describe(toExitStatus, () => {
  it('passes simple typed states through', () => {
    expect(exitStatus({ tipHeight: TIP_HEIGHT, type: 'start' }).state).toStrictEqual({
      tipHeight: TIP_HEIGHT,
      type: 'start'
    })
    expect(exitStatus({ tipHeight: TIP_HEIGHT, type: 'vtxo-already-spent' }).state).toStrictEqual({
      tipHeight: TIP_HEIGHT,
      type: 'vtxo-already-spent'
    })
    expect(exitStatus({ tipHeight: TIP_HEIGHT, type: 'canceled' }).state).toStrictEqual({
      tipHeight: TIP_HEIGHT,
      type: 'canceled'
    })
  })

  it('carries real block refs and txids for claim states', () => {
    expect(
      exitStatus({
        claimableSince: BLOCK,
        lastScannedBlock: undefined,
        tipHeight: TIP_HEIGHT,
        type: 'claimable'
      }).state
    ).toStrictEqual({
      claimableSince: BLOCK,
      lastScannedBlock: undefined,
      tipHeight: TIP_HEIGHT,
      type: 'claimable'
    })
    expect(
      exitStatus({
        claimTxid: 'c'.repeat(64),
        claimableSince: BLOCK,
        tipHeight: TIP_HEIGHT,
        type: 'claim-in-progress'
      }).state
    ).toStrictEqual({
      claimTxid: 'c'.repeat(64),
      claimableSince: BLOCK,
      tipHeight: TIP_HEIGHT,
      type: 'claim-in-progress'
    })
    expect(
      exitStatus({ block: BLOCK, tipHeight: TIP_HEIGHT, txid: 'd'.repeat(64), type: 'claimed' })
        .state
    ).toStrictEqual({
      block: BLOCK,
      tipHeight: TIP_HEIGHT,
      txid: 'd'.repeat(64),
      type: 'claimed'
    })
    expect(
      exitStatus({
        claimableHeight: 950,
        confirmedBlock: BLOCK,
        tipHeight: TIP_HEIGHT,
        type: 'awaiting-delta'
      }).state
    ).toStrictEqual({
      claimableHeight: 950,
      confirmedBlock: BLOCK,
      tipHeight: TIP_HEIGHT,
      type: 'awaiting-delta'
    })
  })

  it('maps processing transactions including their statuses', () => {
    const { state } = exitStatus({
      tipHeight: TIP_HEIGHT,
      transactions: [
        { status: { type: 'awaiting-cpfp-broadcast' }, txid: 'e'.repeat(64) },
        {
          status: {
            block: BLOCK,
            childTxid: 'f'.repeat(64),
            origin: { confirmedIn: BLOCK, type: 'block' },
            type: 'confirmed'
          },
          txid: 'a'.repeat(64)
        }
      ],
      type: 'processing'
    })
    expect(state).toStrictEqual({
      tipHeight: TIP_HEIGHT,
      transactions: [
        { status: { type: 'awaiting-cpfp-broadcast' }, txid: 'e'.repeat(64) },
        {
          status: {
            block: BLOCK,
            childTxid: 'f'.repeat(64),
            origin: { confirmedIn: BLOCK, type: 'block' },
            type: 'confirmed'
          },
          txid: 'a'.repeat(64)
        }
      ],
      type: 'processing'
    })
  })

  it('degrades a state type added by newer bindings to start', () => {
    const future = { tipHeight: TIP_HEIGHT, type: 'some-future-variant' }
    // oxlint-disable-next-line no-unsafe-type-assertion -- deliberately malformed to exercise the fallback
    expect(exitStatus(future as unknown as WasmExitState).state).toStrictEqual({
      tipHeight: TIP_HEIGHT,
      type: 'start'
    })
  })

  it('maps history entries through the same state mapper', () => {
    const status = toExitStatus(
      {
        amountSats: 1000,
        isClaimable: false,
        state: { block: BLOCK, tipHeight: TIP_HEIGHT, txid: 'd'.repeat(64), type: 'claimed' },
        vtxoId: 'vtxo-1'
      },
      [
        { tipHeight: 100, type: 'start' },
        { claimableSince: BLOCK, lastScannedBlock: undefined, tipHeight: 200, type: 'claimable' }
      ]
    )
    expect(status.history).toStrictEqual([
      { tipHeight: 100, type: 'start' },
      { claimableSince: BLOCK, lastScannedBlock: undefined, tipHeight: 200, type: 'claimable' }
    ])
  })

  it('leaves history null when the bindings supply none', () => {
    expect(exitStatus({ tipHeight: TIP_HEIGHT, type: 'start' }).history).toBeNull()
  })
})

function vtxo(state: WasmVtxoState): WasmVtxo {
  return {
    amountSats: 5000,
    exitDepth: 1,
    exitTxWeightWu: 500,
    expiryHeight: 1000,
    id: 'vtxo-1',
    kind: 'pubkey',
    registered: true,
    state
  }
}

describe(toVtxo, () => {
  it('passes simple states through', () => {
    expect(toVtxo(vtxo({ type: 'spendable' })).state).toStrictEqual({ type: 'spendable' })
    expect(toVtxo(vtxo({ type: 'spent' })).state).toStrictEqual({ type: 'spent' })
    expect(toVtxo(vtxo({ type: 'exited' })).state).toStrictEqual({ type: 'exited' })
  })

  it('maps a movement lock holder to movementId', () => {
    expect(
      toVtxo(vtxo({ holder: { id: 42, type: 'movement' }, type: 'locked' })).state
    ).toStrictEqual({ movementId: 42, type: 'locked' })
  })

  it('maps an action lock holder to actionId', () => {
    expect(
      toVtxo(vtxo({ holder: { id: 'action-7', type: 'action' }, type: 'locked' })).state
    ).toStrictEqual({ actionId: 'action-7', type: 'locked' })
  })

  it('keeps a holderless lock as a bare locked state', () => {
    expect(toVtxo(vtxo({ holder: undefined, type: 'locked' })).state).toStrictEqual({
      type: 'locked'
    })
  })
})

function movement(overrides: Partial<WasmMovement>): WasmMovement {
  return {
    completedAt: undefined,
    createdAt: '2026-07-20T00:00:00Z',
    effectiveBalanceSats: 0,
    exitedVtxoIds: [],
    id: 1,
    inputVtxoIds: [],
    intendedBalanceSats: 0,
    lightningInvoice: undefined,
    lightningOffer: undefined,
    metadataJson: '',
    offchainFeeSats: 0,
    outputVtxoIds: [],
    paymentHash: undefined,
    receivedOnAddresses: [],
    sentToAddresses: [],
    status: 'successful',
    subsystemKind: 'arkoor',
    subsystemName: 'arkoor',
    updatedAt: '2026-07-20T00:00:00Z',
    ...overrides
  }
}

describe('toMovement destinations', () => {
  it('parses PaymentMethod JSON entries into address and payment type', () => {
    const mapped = toMovement(
      movement({ sentToAddresses: ['{"type":"ark","value":"tark1qexample"}'] })
    )
    expect(mapped.sentTo).toStrictEqual([
      { amountSats: 0, paymentType: 'ark', value: 'tark1qexample' }
    ])
  })

  it('drops unknown payment types but keeps the address', () => {
    const mapped = toMovement(
      movement({ receivedOnAddresses: ['{"type":"weird","value":"bc1qexample"}'] })
    )
    expect(mapped.receivedOn).toStrictEqual([
      { amountSats: 0, paymentType: undefined, value: 'bc1qexample' }
    ])
  })

  it('passes bare address strings through unchanged', () => {
    const mapped = toMovement(movement({ sentToAddresses: ['bc1qplainaddress'] }))
    expect(mapped.sentTo).toStrictEqual([{ amountSats: 0, value: 'bc1qplainaddress' }])
  })

  it('passes malformed JSON entries through as bare values', () => {
    const mapped = toMovement(movement({ sentToAddresses: ['{"type":'] }))
    expect(mapped.sentTo).toStrictEqual([{ amountSats: 0, value: '{"type":' }])
  })
})

function feeSchedule(): WasmFeeSchedule {
  return {
    board: { baseFeeSats: 0, minFeeSats: 0, ppm: 0 },
    lightningReceive: { baseFeeSats: 0, ppm: 0 },
    lightningSend: { baseFeeSats: 0, minFeeSats: 0, ppmExpiryTable: [] },
    offboard: { baseFeeSats: 0, fixedAdditionalVb: 0, ppmExpiryTable: [] },
    refresh: {
      baseFeeSats: 25,
      ppmExpiryTable: [
        { expiryBlocksThreshold: 0, ppm: 0 },
        { expiryBlocksThreshold: 145, ppm: 250 }
      ]
    }
  }
}

function arkInfo(): WasmArkInfo {
  return {
    feeSchedule: feeSchedule(),
    htlcExpiryDelta: 24,
    htlcSendExpiryDelta: 24,
    lnReceiveAntiDosRequired: false,
    maxUserInvoiceCltvDelta: 200,
    maxVtxoAmountSats: undefined,
    maxVtxoExitDepth: 4,
    minBoardAmountSats: 10_000,
    nbRoundNonces: 8,
    network: 'Signet',
    requiredBoardConfirmations: 1,
    roundIntervalSecs: 60,
    serverPubkey: 'pubkey',
    vtxoExitDelta: 12,
    vtxoExpiryDelta: 1008
  }
}

describe(toArkInfo, () => {
  // The payoff of the typed fee schedule: the auto-refresh dropdown builds real
  // fee tiers instead of the generic zero-fee hour tiers.
  it('surfaces the real refresh tiers to the threshold options', () => {
    const mapped = toArkInfo(arkInfo())
    expect(mapped.fees.refresh.baseFeeSats).toBe(25)
    const options = getRefreshThresholdOptions(mapped.vtxoExpiryDelta, mapped.fees.refresh)
    expect(options).toContainEqual({ blocks: 144, ppm: 0 })
  })

  it('maps every fee schedule slice', () => {
    const mapped = toArkInfo(arkInfo())
    expect(mapped.fees).toStrictEqual(feeSchedule())
  })
})

describe(toWalletTx, () => {
  it('maps txHex to the domain tx field with signed balance change', () => {
    const dto: WasmWalletTransaction = {
      balanceChangeSats: -1500,
      confirmation: BLOCK,
      isCpfp: true,
      onchainFeeSats: 210,
      txHex: '0200aabb',
      txid: 'a'.repeat(64)
    }
    expect(toWalletTx(dto)).toStrictEqual({
      balanceChangeSats: -1500,
      confirmation: BLOCK,
      isCpfp: true,
      onchainFeeSats: 210,
      tx: '0200aabb',
      txid: 'a'.repeat(64)
    })
  })

  it('keeps mempool transactions unconfirmed with unknown fee', () => {
    const dto: WasmWalletTransaction = {
      balanceChangeSats: 800,
      confirmation: undefined,
      isCpfp: false,
      onchainFeeSats: undefined,
      txHex: '0200ccdd',
      txid: 'b'.repeat(64)
    }
    const mapped = toWalletTx(dto)
    expect(mapped.confirmation).toBeUndefined()
    expect(mapped.onchainFeeSats).toBeUndefined()
    expect(mapped.isCpfp).toBeFalsy()
  })
})

describe(toUtxos, () => {
  it('maps local utxos to txid:vout outpoints', () => {
    const dtos: WasmOnchainUtxo[] = [
      {
        amountSats: 4000,
        confirmationHeight: 890,
        outpoint: { txid: 'a'.repeat(64), vout: 1 },
        type: 'local'
      }
    ]
    expect(toUtxos(dtos)).toStrictEqual([
      { amountSats: 4000, confirmationHeight: 890, outpoint: `${'a'.repeat(64)}:1` }
    ])
  })

  it('excludes exit-variant utxos, which carry no outpoint', () => {
    const dtos: WasmOnchainUtxo[] = [
      { amountSats: 2000, height: 880, type: 'exit', vtxoId: 'vtxo-9' },
      {
        amountSats: 4000,
        confirmationHeight: undefined,
        outpoint: { txid: 'b'.repeat(64), vout: 0 },
        type: 'local'
      }
    ]
    expect(toUtxos(dtos)).toStrictEqual([
      { amountSats: 4000, confirmationHeight: undefined, outpoint: `${'b'.repeat(64)}:0` }
    ])
  })
})

describe(toOnchainFeeRates, () => {
  it('converts sat/kwu to sat/vB rounding up', () => {
    expect(
      toOnchainFeeRates({ fastSatPerKwu: 2510, regularSatPerKwu: 1250, slowSatPerKwu: 250 })
    ).toStrictEqual({ fastSatPerVb: 11, regularSatPerVb: 5, slowSatPerVb: 1 })
  })

  it('floors every tier at 1 sat/vB', () => {
    expect(
      toOnchainFeeRates({ fastSatPerKwu: 0, regularSatPerKwu: 0, slowSatPerKwu: 0 })
    ).toStrictEqual({ fastSatPerVb: 1, regularSatPerVb: 1, slowSatPerVb: 1 })
  })

  it('clamps the tiers monotonic when the estimator is noisy', () => {
    expect(
      toOnchainFeeRates({ fastSatPerKwu: 1000, regularSatPerKwu: 3000, slowSatPerKwu: 2000 })
    ).toStrictEqual({ fastSatPerVb: 4, regularSatPerVb: 4, slowSatPerVb: 4 })
  })
})

describe(toOffboardTxid, () => {
  const TXID = 'a'.repeat(32) + '0123456789abcdef'.repeat(2)

  it('extracts the funding txid from confirmed and unconfirmed round statuses', () => {
    expect(toOffboardTxid(`Confirmed { funding_txid: ${TXID} }`)).toBe(TXID)
    expect(toOffboardTxid(`Unconfirmed { funding_txid: ${TXID} }`)).toBe(TXID)
  })

  it('tolerates a wrapped txid rendering', () => {
    expect(toOffboardTxid(`Unconfirmed { funding_txid: Txid(${TXID}) }`)).toBe(TXID)
  })

  it('returns null for statuses without a funding txid', () => {
    expect(toOffboardTxid('Pending')).toBeNull()
    expect(toOffboardTxid('Canceled')).toBeNull()
    expect(toOffboardTxid('Failed { error: "round aborted" }')).toBeNull()
  })

  it('never extracts a txid out of a failure message', () => {
    expect(toOffboardTxid(`Failed { error: "funding_txid: ${TXID}" }`)).toBeNull()
  })
})
