import type {
  ArkInfo as WasmArkInfo,
  Balance as WasmBalance,
  ExitState as WasmExitState,
  ExitTx as WasmExitTx,
  ExitTxOrigin as WasmExitTxOrigin,
  ExitTxStatus as WasmExitTxStatus,
  ExitVtxo as WasmExitVtxo,
  FeeEstimate as WasmFeeEstimate,
  FeeRates as WasmFeeRates,
  FeeSchedule as WasmFeeSchedule,
  Movement as WasmMovement,
  OnchainBalance as WasmOnchainBalance,
  OnchainUtxo as WasmOnchainUtxo,
  PendingBoard as WasmPendingBoard,
  RoundState as WasmRoundState,
  Vtxo as WasmVtxo,
  VtxoState as WasmVtxoState,
  WalletNotification as WasmWalletNotification,
  WalletTransaction as WasmWalletTransaction
} from '@secondts/bark'
import { getMovementMetadata } from '@/lib/backend/wasm/metadata-store'
import type { ArkInfo } from '@/types/domain/ark'
import type { Balance, OnchainBalance } from '@/types/domain/balance'
import type { PendingBoard } from '@/types/domain/board'
import type {
  ExitState,
  ExitTransactionStatus,
  ExitTx,
  ExitTxOrigin,
  ExitTxStatus
} from '@/types/domain/exit'
import type { FeeEstimate, FeeSchedule, OnchainFeeRates } from '@/types/domain/fees'
import { PAYMENT_TYPES } from '@/types/domain/movement'
import type { Movement, MovementDestination, MovementStatus } from '@/types/domain/movement'
import type { WalletNotification } from '@/types/domain/notification'
import type { Utxo, WalletTx } from '@/types/domain/onchain'
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

function toFeeSchedule(dto: WasmFeeSchedule): FeeSchedule {
  return {
    board: {
      baseFeeSats: dto.board.baseFeeSats,
      minFeeSats: dto.board.minFeeSats,
      ppm: dto.board.ppm
    },
    lightningReceive: {
      baseFeeSats: dto.lightningReceive.baseFeeSats,
      ppm: dto.lightningReceive.ppm
    },
    lightningSend: {
      baseFeeSats: dto.lightningSend.baseFeeSats,
      minFeeSats: dto.lightningSend.minFeeSats,
      ppmExpiryTable: dto.lightningSend.ppmExpiryTable
    },
    offboard: {
      baseFeeSats: dto.offboard.baseFeeSats,
      fixedAdditionalVb: dto.offboard.fixedAdditionalVb,
      ppmExpiryTable: dto.offboard.ppmExpiryTable
    },
    refresh: {
      baseFeeSats: dto.refresh.baseFeeSats,
      ppmExpiryTable: dto.refresh.ppmExpiryTable
    }
  }
}

export function toArkInfo(dto: WasmArkInfo): ArkInfo {
  return {
    fees: toFeeSchedule(dto.feeSchedule),
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
    vtxoExpiryDelta: dto.vtxoLifetime
  }
}

// A locked VTXO's holder is legitimately absent in the window between creating
// the locked VTXO and pinning it to an operation, so `{ type: 'locked' }`
// without ids is a valid state, not a mapping failure.
function toVtxoState(state: WasmVtxoState): VtxoState {
  if (state.type !== 'locked') {
    return { type: state.type }
  }
  if (state.holder?.type === 'movement') {
    return { movementId: state.holder.id, type: 'locked' }
  }
  if (state.holder?.type === 'action') {
    return { actionId: state.holder.id, type: 'locked' }
  }
  return { type: 'locked' }
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

function toExitTxOrigin(origin: WasmExitTxOrigin): ExitTxOrigin {
  if (origin.type === 'block') {
    return { confirmedIn: origin.confirmedIn, type: 'block' }
  }
  if (origin.type === 'wallet') {
    return { confirmedIn: origin.confirmedIn, type: 'wallet' }
  }
  return { type: 'mempool' }
}

function toExitTxStatus(status: WasmExitTxStatus): ExitTxStatus {
  if (status.type === 'awaiting-input-confirmation') {
    return { txids: status.txids, type: 'awaiting-input-confirmation' }
  }
  if (status.type === 'awaiting-confirmation') {
    return {
      childTxid: status.childTxid,
      origin: toExitTxOrigin(status.origin),
      type: 'awaiting-confirmation'
    }
  }
  if (status.type === 'confirmed') {
    return {
      block: status.block,
      childTxid: status.childTxid,
      origin: toExitTxOrigin(status.origin),
      type: 'confirmed'
    }
  }
  return { type: status.type }
}

function toExitTx(tx: WasmExitTx): ExitTx {
  return { status: toExitTxStatus(tx.status), txid: tx.txid }
}

// A state type added by newer bindings: degrade it to a placeholder so one
// unknown variant cannot reject the whole exits response, mirroring the barkd
// mapper's fallback.
function unknownExitState(state: unknown): ExitState {
  const tipHeight =
    typeof state === 'object' &&
    state !== null &&
    'tipHeight' in state &&
    typeof state.tipHeight === 'number'
      ? state.tipHeight
      : 0
  return { tipHeight, type: 'start' }
}

function toExitState(state: WasmExitState): ExitState {
  switch (state.type) {
    case 'processing': {
      return {
        tipHeight: state.tipHeight,
        transactions: state.transactions.map(toExitTx),
        type: 'processing'
      }
    }
    case 'awaiting-delta': {
      return {
        claimableHeight: state.claimableHeight,
        confirmedBlock: state.confirmedBlock,
        tipHeight: state.tipHeight,
        type: 'awaiting-delta'
      }
    }
    case 'claimable': {
      return {
        claimableSince: state.claimableSince,
        lastScannedBlock: state.lastScannedBlock,
        tipHeight: state.tipHeight,
        type: 'claimable'
      }
    }
    case 'claim-in-progress': {
      return {
        claimTxid: state.claimTxid,
        claimableSince: state.claimableSince,
        tipHeight: state.tipHeight,
        type: 'claim-in-progress'
      }
    }
    case 'claimed': {
      return { block: state.block, tipHeight: state.tipHeight, txid: state.txid, type: 'claimed' }
    }
    case 'vtxo-already-spent': {
      return { tipHeight: state.tipHeight, type: 'vtxo-already-spent' }
    }
    case 'canceled': {
      return { tipHeight: state.tipHeight, type: 'canceled' }
    }
    case 'start': {
      return { tipHeight: state.tipHeight, type: 'start' }
    }
    default: {
      return unknownExitState(state)
    }
  }
}

export function toExitStatus(
  dto: WasmExitVtxo,
  history?: WasmExitState[] | null
): ExitTransactionStatus {
  return {
    history: history?.map(toExitState) ?? null,
    state: toExitState(dto.state),
    vtxoId: dto.vtxoId
  }
}

export function toWalletTx(dto: WasmWalletTransaction): WalletTx {
  return {
    balanceChangeSats: dto.balanceChangeSats,
    confirmation: dto.confirmation,
    isCpfp: dto.isCpfp,
    onchainFeeSats: dto.onchainFeeSats,
    tx: dto.txHex,
    txid: dto.txid
  }
}

// Exit-variant UTXOs carry no outpoint, and every consumer keys on the
// `txid:vout` shape; they were also invisible on the old esplora path. Only
// local (BDK-owned) UTXOs map into the domain.
export function toUtxos(dtos: WasmOnchainUtxo[]): Utxo[] {
  const utxos: Utxo[] = []
  for (const dto of dtos) {
    if (dto.type === 'local') {
      utxos.push({
        amountSats: dto.amountSats,
        confirmationHeight: dto.confirmationHeight,
        outpoint: `${dto.outpoint.txid}:${dto.outpoint.vout}`
      })
    }
  }
  return utxos
}

const KWU_PER_VB = 250
const MIN_SAT_PER_VB = 1

function toSatPerVb(satPerKwu: number): number {
  return Math.max(MIN_SAT_PER_VB, Math.ceil(satPerKwu / KWU_PER_VB))
}

// The bindings report sat/kwu; the domain speaks sat/vB. Clamp the tiers
// monotonic (regular ≤ fast, slow ≤ regular) so a noisy estimator can never
// price "slow" above "fast".
export function toOnchainFeeRates(dto: WasmFeeRates): OnchainFeeRates {
  const fast = toSatPerVb(dto.fastSatPerKwu)
  const regular = Math.min(toSatPerVb(dto.regularSatPerKwu), fast)
  const slow = Math.min(toSatPerVb(dto.slowSatPerKwu), regular)
  return { fastSatPerVb: fast, regularSatPerVb: regular, slowSatPerVb: slow }
}
