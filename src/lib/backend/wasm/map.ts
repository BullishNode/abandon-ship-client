import type {
  ArkInfo as WasmArkInfo,
  Balance as WasmBalance,
  ExitVtxo as WasmExitVtxo,
  FeeEstimate as WasmFeeEstimate,
  Movement as WasmMovement,
  OnchainBalance as WasmOnchainBalance,
  PendingBoard as WasmPendingBoard,
  RoundState as WasmRoundState,
  Vtxo as WasmVtxo,
  WalletNotification as WasmWalletNotification
} from '@secondts/bark'
import { parseFeeSchedule } from '@/lib/backend/wasm/fee-schedule'
import { getMovementMetadata } from '@/lib/backend/wasm/metadata-store'
import type { ArkInfo } from '@/types/domain/ark'
import type { Balance, OnchainBalance } from '@/types/domain/balance'
import type { PendingBoard } from '@/types/domain/board'
import type { ExitState, ExitTransactionStatus } from '@/types/domain/exit'
import type { FeeEstimate } from '@/types/domain/fees'
import { PAYMENT_TYPES } from '@/types/domain/movement'
import type { Movement, MovementDestination, MovementStatus } from '@/types/domain/movement'
import type { WalletNotification } from '@/types/domain/notification'
import type { NextRoundStart, PendingRound } from '@/types/domain/round'
import type { Vtxo, VtxoState } from '@/types/domain/vtxo'

export function toBalance(dto: WasmBalance): Balance {
  return {
    claimableLightningReceiveSats: dto.claimableLightningReceiveSats,
    pendingBoardSats: dto.pendingBoardSats,
    pendingExitSats: dto.pendingExitSats,
    pendingInRoundSats: dto.pendingInRoundSats,
    pendingLightningSendSats: dto.pendingLightningSendSats,
    spendableSats: dto.spendableSats
  }
}

// The WASM OnchainWallet exposes only confirmed/pending/total. Map confirmed to
// the "trusted spendable" the balance utils read and pending to the "untrusted
// pending" bucket, so totals stay correct with the coarser data.
export function toOnchainBalance(dto: WasmOnchainBalance): OnchainBalance {
  return {
    confirmedSats: dto.confirmedSats,
    immatureSats: 0,
    totalSats: dto.totalSats,
    trustedPendingSats: 0,
    trustedSpendableSats: dto.confirmedSats,
    untrustedPendingSats: dto.pendingSats
  }
}

export function toArkInfo(dto: WasmArkInfo): ArkInfo {
  return {
    fees: parseFeeSchedule(dto.feeScheduleJson),
    htlcExpiryDelta: dto.htlcExpiryDelta,
    htlcSendExpiryDelta: dto.htlcSendExpiryDelta,
    lnReceiveAntiDosRequired: dto.lnReceiveAntiDosRequired,
    maxUserInvoiceCltvDelta: dto.maxUserInvoiceCltvDelta,
    maxVtxoAmountSats: dto.maxVtxoAmountSats,
    maxVtxoExitDepth: dto.maxVtxoExitDepth,
    minBoardAmountSats: dto.minBoardAmountSats,
    nbRoundNonces: dto.nbRoundNonces,
    network: dto.network,
    requiredBoardConfirmations: dto.requiredBoardConfirmations,
    roundInterval: `${dto.roundIntervalSecs}s`,
    serverPubkey: dto.serverPubkey,
    vtxoExitDelta: dto.vtxoExitDelta,
    vtxoExpiryDelta: dto.vtxoExpiryDelta
  }
}

// The WASM `Vtxo.state` string is the serde-tagged bark enum: spendable / locked
// / spent / exited (verified against the bindings). `movementId` is never
// available here, so the lock label falls back to none (see mapVtxoLockLabels).
function toVtxoState(state: string): VtxoState {
  switch (state.toLowerCase()) {
    case 'spent': {
      return { type: 'spent' }
    }
    case 'exited': {
      return { type: 'exited' }
    }
    case 'locked': {
      return { type: 'locked' }
    }
    default: {
      return { type: 'spendable' }
    }
  }
}

export function toVtxo(dto: WasmVtxo): Vtxo {
  return {
    amountSats: dto.amountSats,
    exitDepth: dto.exitDepth,
    expiryHeight: dto.expiryHeight,
    id: dto.id,
    policyType: dto.kind,
    state: toVtxoState(dto.state)
  }
}

// Verified bark serde tags: pending / successful / failed / canceled.
function toMovementStatus(status: string): MovementStatus {
  switch (status.toLowerCase()) {
    case 'successful': {
      return 'successful'
    }
    case 'failed': {
      return 'failed'
    }
    case 'canceled': {
      return 'canceled'
    }
    default: {
      return 'pending'
    }
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Each ffi destination entry is bark's PaymentMethod serialized as JSON —
// `{"type":"ark","value":"tark1…"}` — whose `type` tags match the domain
// PaymentType union. Parse out the real address so counterparty display and
// send-label binding promotion match on it; amounts are not part of this
// surface, so amountSats stays 0.
function toDestination(entry: string): MovementDestination {
  try {
    const parsed: unknown = JSON.parse(entry)
    if (isPlainRecord(parsed) && typeof parsed.value === 'string') {
      return {
        amountSats: 0,
        paymentType: PAYMENT_TYPES.find((type) => type === parsed.type),
        value: parsed.value
      }
    }
  } catch {
    // not JSON: fall through and treat the entry as a bare address
  }
  return { amountSats: 0, value: entry }
}

function toDestinations(addresses: string[]): MovementDestination[] {
  return addresses.map(toDestination)
}

function parseMetadataJson(metadataJson: string): Record<string, unknown> {
  if (metadataJson.length === 0) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(metadataJson)
    return isPlainRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function toMovement(dto: WasmMovement): Movement {
  const metadata = { ...parseMetadataJson(dto.metadataJson), ...getMovementMetadata(dto.id) }
  return {
    completedAt: dto.completedAt ?? null,
    createdAt: dto.createdAt,
    effectiveBalanceSats: dto.effectiveBalanceSats,
    exitedVtxos: dto.exitedVtxoIds,
    id: dto.id,
    inputVtxos: dto.inputVtxoIds,
    intendedBalanceSats: dto.intendedBalanceSats,
    metadata,
    offchainFeeSats: dto.offchainFeeSats,
    outputVtxos: dto.outputVtxoIds,
    receivedOn: toDestinations(dto.receivedOnAddresses),
    sentTo: toDestinations(dto.sentToAddresses),
    status: toMovementStatus(dto.status),
    subsystem: { kind: dto.subsystemKind, name: dto.subsystemName },
    updatedAt: dto.updatedAt
  }
}

export function toPendingRound(dto: WasmRoundState): PendingRound {
  return { id: dto.id, ongoing: dto.ongoing }
}

export function toPendingBoard(dto: WasmPendingBoard): PendingBoard {
  return { amountSats: dto.amountSats, fundingTxid: dto.txid, vtxos: [dto.vtxoId] }
}

const MS_PER_SECOND = 1000
const MS_THRESHOLD = 1e12

// `nextRoundStartTime()` returns a unix timestamp. Treat it as seconds unless the
// magnitude is already millisecond-scale, so either unit maps to a valid ISO
// string.
export function toNextRoundStart(startTime: number): NextRoundStart {
  const ms = startTime > MS_THRESHOLD ? startTime : startTime * MS_PER_SECOND
  return { startTime: new Date(ms).toISOString() }
}

export function toFeeEstimate(dto: WasmFeeEstimate): FeeEstimate {
  return {
    feeSats: dto.feeSats,
    grossAmountSats: dto.grossAmountSats,
    netAmountSats: dto.netAmountSats,
    vtxosSpent: dto.vtxosSpent
  }
}

export function toWalletNotification(dto: WasmWalletNotification): WalletNotification {
  if (dto.type === 'MovementCreated') {
    return { movement: toMovement(dto.movement), type: 'movement-created' }
  }
  if (dto.type === 'MovementUpdated') {
    return { movement: toMovement(dto.movement), type: 'movement-updated' }
  }
  return { type: 'channel-lagging' }
}

// The WASM `ExitVtxo.state` string is the Rust Debug rendering of bark's
// ExitState — a PascalCase variant name usually followed by its payload, e.g.
// "Claimable(ExitClaimableState { tip_height: 123, .. })" — not the serde
// kebab-case tag. Take the leading variant identifier and kebab-case it; the
// serde tags are accepted too in case a future ffi switches to them.
const EXIT_STATE_IDENTIFIER = /^[A-Za-z-]+/u
const PASCAL_BOUNDARY = /(?<=[a-z])(?=[A-Z])/gu

function exitStateTag(state: string): string {
  const identifier = EXIT_STATE_IDENTIFIER.exec(state)?.[0] ?? ''
  return identifier.replaceAll(PASCAL_BOUNDARY, '-').toLowerCase()
}

// Block references are not exposed by this surface, so block fields are filled
// with the current tip height as a placeholder. `isClaimable` backstops the
// string parsing: a claimable exit must never be missed by the auto-claim flow.
function toExitState(state: string, tipHeight: number, isClaimable: boolean): ExitState {
  const block = { hash: '', height: tipHeight }
  const tag = exitStateTag(state)
  if (isClaimable && tag !== 'claim-in-progress' && tag !== 'claimed') {
    return { claimableSince: block, tipHeight, type: 'claimable' }
  }
  switch (tag) {
    case 'claimed': {
      return { block, tipHeight, txid: '', type: 'claimed' }
    }
    case 'vtxo-already-spent': {
      return { tipHeight, type: 'vtxo-already-spent' }
    }
    case 'canceled': {
      return { tipHeight, type: 'canceled' }
    }
    case 'claim-in-progress': {
      return { claimTxid: '', claimableSince: block, tipHeight, type: 'claim-in-progress' }
    }
    case 'claimable': {
      return { claimableSince: block, tipHeight, type: 'claimable' }
    }
    case 'awaiting-delta': {
      return {
        claimableHeight: tipHeight,
        confirmedBlock: block,
        tipHeight,
        type: 'awaiting-delta'
      }
    }
    case 'processing': {
      return { tipHeight, transactions: [], type: 'processing' }
    }
    default: {
      return { tipHeight, type: 'start' }
    }
  }
}

export function toExitStatus(dto: WasmExitVtxo, tipHeight: number): ExitTransactionStatus {
  return {
    state: toExitState(dto.state, tipHeight, dto.isClaimable),
    vtxoId: dto.vtxoId
  }
}

// The bindings' offboardVtxos() resolves to the Rust Debug rendering of bark's
// RoundStatus, not a bare txid: "Confirmed { funding_txid: <hex> }",
// "Unconfirmed { funding_txid: <hex> }", "Pending", "Failed { error: \"…\" }"
// or "Canceled". Only the first two carry the funding txid; anything else (or
// a future format change) yields null rather than a malformed "txid".
const OFFBOARD_FUNDING_TXID =
  /^(?:Confirmed|Unconfirmed) \{ funding_txid: (?:[A-Za-z_]+\()?([0-9a-f]{64})/u

export function toOffboardTxid(roundStatus: string): string | null {
  return OFFBOARD_FUNDING_TXID.exec(roundStatus)?.[1] ?? null
}
