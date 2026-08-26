import type {
  ArkInfo as BarkdArkInfo,
  Balance as BarkdBalance,
  ExitState as BarkdExitState,
  ExitTransactionPackage as BarkdExitPackage,
  ExitTransactionStatus as BarkdExitStatus,
  ExitTx as BarkdExitTx,
  ExitTxOrigin as BarkdExitTxOrigin,
  ExitTxStatus as BarkdExitTxStatus,
  FeeEstimateResponse,
  FeeSchedule as BarkdFeeSchedule,
  Movement as BarkdMovement,
  MovementDestination as BarkdMovementDestination,
  NextRoundStart as BarkdNextRoundStart,
  OnchainBalance as BarkdOnchainBalance,
  PendingBoardInfo,
  OnchainFeeRatesResponse,
  PendingRoundInfo,
  RefreshFees as BarkdRefreshFees,
  RoundStatus as BarkdRoundStatus,
  UtxoInfo,
  VtxoStateInfo,
  WalletNotification as BarkdWalletNotification,
  WalletTxInfo,
  WalletVtxoInfo
} from '@secondts/barkd'
import type { ArkInfo } from '@/types/domain/ark'
import type { Balance, OnchainBalance } from '@/types/domain/balance'
import type { PendingBoard } from '@/types/domain/board'
import type {
  ExitState,
  ExitTransactionPackage,
  ExitTransactionStatus,
  ExitTx,
  ExitTxOrigin,
  ExitTxStatus
} from '@/types/domain/exit'
import type { FeeEstimate, FeeSchedule, OnchainFeeRates, RefreshFees } from '@/types/domain/fees'
import type { Movement, MovementDestination } from '@/types/domain/movement'
import type { WalletNotification } from '@/types/domain/notification'
import type { Utxo, WalletTx } from '@/types/domain/onchain'
import type { NextRoundStart, PendingRound, RoundStatus } from '@/types/domain/round'
import type { Vtxo, VtxoState } from '@/types/domain/vtxo'

export function toBalance(dto: BarkdBalance): Balance {
  return {
    claimableLightningReceiveSats: dto.claimableLightningReceiveSat,
    pendingBoardSats: dto.pendingBoardSat,
    pendingExitSats: dto.pendingExitSat,
    pendingInRoundSats: dto.pendingInRoundSat,
    pendingLightningSendSats: dto.pendingLightningSendSat,
    spendableSats: dto.spendableSat
  }
}

export function toOnchainBalance(dto: BarkdOnchainBalance): OnchainBalance {
  return {
    confirmedSats: dto.confirmedSat,
    immatureSats: dto.immatureSat,
    totalSats: dto.totalSat,
    trustedPendingSats: dto.trustedPendingSat,
    trustedSpendableSats: dto.trustedSpendableSat,
    untrustedPendingSats: dto.untrustedPendingSat
  }
}

function toMovementDestination(dto: BarkdMovementDestination): MovementDestination {
  return {
    amountSats: dto.amountSat,
    paymentType: dto.destination.type,
    value: dto.destination.value
  }
}

export function toMovement(dto: BarkdMovement): Movement {
  return {
    completedAt: dto.time.completedAt?.toISOString() ?? null,
    createdAt: dto.time.createdAt.toISOString(),
    effectiveBalanceSats: dto.effectiveBalanceSat,
    exitedVtxos: dto.exitedVtxos,
    id: dto.id,
    inputVtxos: dto.inputVtxos,
    intendedBalanceSats: dto.intendedBalanceSat,
    metadata: dto.metadata,
    offchainFeeSats: dto.offchainFeeSat,
    outputVtxos: dto.outputVtxos,
    receivedOn: dto.receivedOn.map(toMovementDestination),
    sentTo: dto.sentTo.map(toMovementDestination),
    status: dto.status,
    subsystem: { kind: dto.subsystem.kind, name: dto.subsystem.name },
    updatedAt: dto.time.updatedAt.toISOString()
  }
}

function toVtxoState(state: VtxoStateInfo): VtxoState {
  if (state.type === 'locked') {
    return { actionId: state.actionId, movementId: state.movementId, type: 'locked' }
  }
  return { type: state.type }
}

export function toVtxo(dto: WalletVtxoInfo): Vtxo {
  return {
    amountSats: dto.amountSat,
    chainAnchor: dto.chainAnchor,
    exitDelta: dto.exitDelta,
    exitDepth: dto.exitDepth,
    expiryHeight: dto.expiryHeight,
    id: dto.id,
    policyType: dto.policyType,
    serverPubkey: dto.serverPubkey,
    state: toVtxoState(dto.state),
    userPubkey: dto.userPubkey
  }
}

function toExitTxOrigin(origin: BarkdExitTxOrigin): ExitTxOrigin {
  if (origin.type === 'block') {
    return { confirmedIn: origin.confirmedIn, type: 'block' }
  }
  if (origin.type === 'wallet') {
    return { confirmedIn: origin.confirmedIn, type: 'wallet' }
  }
  return { type: 'mempool' }
}

function toExitTxStatus(status: BarkdExitTxStatus): ExitTxStatus {
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

function toExitTx(tx: BarkdExitTx): ExitTx {
  return { status: toExitTxStatus(tx.status), txid: tx.txid }
}

// The generated client parses an unknown oneOf discriminator (a state type
// added by a newer barkd) into a bare object instead of failing. Degrade such
// a state to a placeholder so one unknown variant cannot reject the whole
// exits/rounds response, mirroring the WASM mapper's fallback.
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

function toExitState(state: BarkdExitState): ExitState {
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

function toExitPackage(pkg: BarkdExitPackage): ExitTransactionPackage {
  return {
    child: pkg.child
      ? {
          feeInfo: pkg.child.feeInfo
            ? {
                feeRateSatPerKvb: pkg.child.feeInfo.feeRateSatPerKvb,
                totalFeeSats: pkg.child.feeInfo.totalFeeSat
              }
            : null,
          info: pkg.child.info,
          origin: toExitTxOrigin(pkg.child.origin)
        }
      : null,
    exit: pkg.exit
  }
}

export function toExitStatus(dto: BarkdExitStatus): ExitTransactionStatus {
  return {
    history: dto.history?.map(toExitState) ?? null,
    state: toExitState(dto.state),
    transactions: dto.transactions?.map(toExitPackage),
    vtxoId: dto.vtxoId
  }
}

export function toPendingBoard(dto: PendingBoardInfo): PendingBoard {
  return {
    amountSats: dto.amountSat,
    fundingTxid: dto.fundingTx.txid,
    vtxos: dto.vtxos
  }
}

export function toWalletTx(dto: WalletTxInfo): WalletTx {
  return {
    balanceChangeSats: dto.balanceChangeSat,
    confirmation: dto.confirmation,
    isCpfp: dto.isCpfp,
    onchainFeeSats: dto.onchainFeeSat,
    tx: dto.tx,
    txid: dto.txid
  }
}

export function toUtxo(dto: UtxoInfo): Utxo {
  return {
    amountSats: dto.amountSat,
    confirmationHeight: dto.confirmationHeight,
    outpoint: dto.outpoint
  }
}

export function toFeeEstimate(dto: FeeEstimateResponse): FeeEstimate {
  return {
    feeSats: dto.feeSat,
    grossAmountSats: dto.grossAmountSat,
    netAmountSats: dto.netAmountSat,
    vtxosSpent: dto.vtxosSpent
  }
}

export function toOnchainFeeRates(dto: OnchainFeeRatesResponse): OnchainFeeRates {
  return {
    fastSatPerVb: dto.fastSatPerVb,
    regularSatPerVb: dto.regularSatPerVb,
    slowSatPerVb: dto.slowSatPerVb
  }
}

function toRefreshFees(dto: BarkdRefreshFees): RefreshFees {
  return { baseFeeSats: dto.baseFeeSat, ppmExpiryTable: dto.ppmExpiryTable }
}

function toFeeSchedule(dto: BarkdFeeSchedule): FeeSchedule {
  return {
    board: {
      baseFeeSats: dto.board.baseFeeSat,
      minFeeSats: dto.board.minFeeSat,
      ppm: dto.board.ppm
    },
    lightningReceive: {
      baseFeeSats: dto.lightningReceive.baseFeeSat,
      ppm: dto.lightningReceive.ppm
    },
    lightningSend: {
      baseFeeSats: dto.lightningSend.baseFeeSat,
      minFeeSats: dto.lightningSend.minFeeSat,
      ppmExpiryTable: dto.lightningSend.ppmExpiryTable
    },
    offboard: {
      baseFeeSats: dto.offboard.baseFeeSat,
      fixedAdditionalVb: dto.offboard.fixedAdditionalVb,
      ppmExpiryTable: dto.offboard.ppmExpiryTable
    },
    refresh: toRefreshFees(dto.refresh)
  }
}

export function toArkInfo(dto: BarkdArkInfo): ArkInfo {
  return {
    fees: toFeeSchedule(dto.fees),
    htlcExpiryDelta: dto.htlcExpiryDelta,
    htlcSendExpiryDelta: dto.htlcSendExpiryDelta,
    lnReceiveAntiDosRequired: dto.lnReceiveAntiDosRequired,
    mailboxPubkey: dto.mailboxPubkey,
    maxUserInvoiceCltvDelta: dto.maxUserInvoiceCltvDelta,
    maxVtxoAmountSats: dto.maxVtxoAmount,
    maxVtxoExitDepth: dto.maxVtxoExitDepth,
    minBoardAmountSats: dto.minBoardAmountSat,
    nbRoundNonces: dto.nbRoundNonces,
    network: dto.network,
    offboardFeerateSatPerKvb: dto.offboardFeerateSatPerKvb,
    requiredBoardConfirmations: dto.requiredBoardConfirmations,
    roundInterval: dto.roundInterval,
    serverPubkey: dto.serverPubkey,
    vtxoExitDelta: dto.vtxoExitDelta,
    vtxoExpiryDelta: dto.vtxoLifetime ?? dto.vtxoExpiryDelta
  }
}

function toRoundStatus(status: BarkdRoundStatus): RoundStatus {
  switch (status.status) {
    case 'sync-error': {
      return { error: status.error, type: 'sync-error' }
    }
    case 'confirmed': {
      return { fundingTxid: status.fundingTxid, type: 'confirmed' }
    }
    case 'unconfirmed': {
      return { fundingTxid: status.fundingTxid, type: 'unconfirmed' }
    }
    case 'failed': {
      return { error: status.error, type: 'failed' }
    }
    case 'canceled': {
      return { type: 'canceled' }
    }
    case 'pending': {
      return { type: 'pending' }
    }
    default: {
      // A status type added by a newer barkd: treat the round as still pending
      // (the conservative reading — the UI keeps watching it) instead of
      // rejecting the whole rounds response.
      return { type: 'pending' }
    }
  }
}

export function toPendingRound(dto: PendingRoundInfo): PendingRound {
  return {
    fundingTxHex: dto.fundingTxHex,
    fundingTxid: dto.fundingTxid,
    id: dto.id,
    participation: {
      inputs: dto.participation.inputs,
      outputs: dto.participation.outputs.map((output) => ({
        amountSats: output.amountSat,
        policyType: output.policyType,
        userPubkey: output.userPubkey
      }))
    },
    status: toRoundStatus(dto.status),
    unlockHash: dto.unlockHash
  }
}

export function toNextRoundStart(dto: BarkdNextRoundStart): NextRoundStart {
  return { startTime: dto.startTime.toISOString() }
}

// Null for notification types this client does not know (a newer barkd may add
// some): they must be ignored, not coerced into 'channel-lagging', which would
// fire a movement resync per unknown payload.
export function toWalletNotification(dto: BarkdWalletNotification): WalletNotification | null {
  if (dto.type === 'movement-created') {
    return { movement: toMovement(dto.movement), type: 'movement-created' }
  }
  if (dto.type === 'movement-updated') {
    return { movement: toMovement(dto.movement), type: 'movement-updated' }
  }
  if (dto.type === 'channel-lagging') {
    return { type: 'channel-lagging' }
  }
  return null
}
