import { describe, expect, it } from 'vitest'
import type { ArkInfo as WasmArkInfo, Movement as WasmMovement } from '@secondts/bark'
import { toArkInfo, toExitStatus, toMovement, toOffboardTxid } from '@/lib/backend/wasm/map'
import { getRefreshThresholdOptions } from '@/utils/refresh'

const TIP_HEIGHT = 900

function exitStatus(state: string, isClaimable = false) {
  return toExitStatus({ amountSats: 1000, isClaimable, state, vtxoId: 'vtxo-1' }, TIP_HEIGHT)
}

describe(toExitStatus, () => {
  it('maps Rust Debug variant renderings to domain exit states', () => {
    expect(exitStatus('Start(ExitStartState { tip_height: 900 })').state.type).toBe('start')
    expect(exitStatus('Processing(ExitProcessingState { .. })').state.type).toBe('processing')
    expect(exitStatus('AwaitingDelta(ExitAwaitingDeltaState { .. })').state.type).toBe(
      'awaiting-delta'
    )
    expect(exitStatus('Claimable(ExitClaimableState { tip_height: 900 })').state.type).toBe(
      'claimable'
    )
    expect(exitStatus('ClaimInProgress(ExitClaimInProgressState { .. })').state.type).toBe(
      'claim-in-progress'
    )
    expect(exitStatus('Claimed(ExitClaimedState { .. })').state.type).toBe('claimed')
    expect(exitStatus('VtxoAlreadySpent(ExitVtxoAlreadySpentState { .. })').state.type).toBe(
      'vtxo-already-spent'
    )
  })

  it('maps serde kebab-case tags to domain exit states', () => {
    expect(exitStatus('claimable').state.type).toBe('claimable')
    expect(exitStatus('awaiting-delta').state.type).toBe('awaiting-delta')
    expect(exitStatus('claim-in-progress').state.type).toBe('claim-in-progress')
  })

  it('falls back to claimable when isClaimable is set and the string is unrecognized', () => {
    expect(exitStatus('SomeFutureVariant(..)', true).state.type).toBe('claimable')
  })

  it('does not let isClaimable override terminal states', () => {
    expect(exitStatus('Claimed(ExitClaimedState { .. })', true).state.type).toBe('claimed')
    expect(exitStatus('ClaimInProgress(..)', true).state.type).toBe('claim-in-progress')
  })

  it('falls back to start for unknown non-claimable states', () => {
    expect(exitStatus('SomeFutureVariant(..)').state.type).toBe('start')
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

function arkInfo(feeScheduleJson: string): WasmArkInfo {
  return {
    feeScheduleJson,
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
  const REFRESH_TIERS = JSON.stringify({
    board: { base_fee_sat: 0, min_fee_sat: 0, ppm: 0 },
    lightning_receive: { base_fee_sat: 0, ppm: 0 },
    lightning_send: { base_fee_sat: 0, min_fee_sat: 0, ppm_expiry_table: [] },
    offboard: { base_fee_sat: 0, fixed_additional_vb: 0, ppm_expiry_table: [] },
    refresh: {
      base_fee_sat: 25,
      ppm_expiry_table: [
        { expiry_blocks_threshold: 0, ppm: 0 },
        { expiry_blocks_threshold: 145, ppm: 250 }
      ]
    }
  })

  // The payoff of parsing feeScheduleJson: the auto-refresh dropdown builds real
  // fee tiers instead of the generic zero-fee hour tiers.
  it('surfaces the real refresh tiers to the threshold options', () => {
    const mapped = toArkInfo(arkInfo(REFRESH_TIERS))
    expect(mapped.fees?.refresh.baseFeeSats).toBe(25)
    const options = getRefreshThresholdOptions(mapped.vtxoExpiryDelta, mapped.fees?.refresh)
    expect(options).toContainEqual({ blocks: 144, ppm: 0 })
  })

  it('leaves fees undefined when the schedule cannot be parsed', () => {
    const mapped = toArkInfo(arkInfo('not json'))
    expect(mapped.fees).toBeUndefined()
    const options = getRefreshThresholdOptions(mapped.vtxoExpiryDelta, mapped.fees?.refresh)
    expect(options.every((option) => option.ppm === 0)).toBeTruthy()
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
