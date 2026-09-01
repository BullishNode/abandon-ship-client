import type { ArkInfo } from '@/types/domain/ark'
import type { Balance, OnchainBalance } from '@/types/domain/balance'
import type { PendingBoard } from '@/types/domain/board'
import type { ExitClaimResult, ExitStartResult, ExitTransactionStatus } from '@/types/domain/exit'
import type { FeeEstimate, OnchainFeeRates } from '@/types/domain/fees'
import type { Movement } from '@/types/domain/movement'
import type { WalletNotification } from '@/types/domain/notification'
import type { Utxo, WalletTx } from '@/types/domain/onchain'
import type { NextRoundStart, PendingRound, RefreshingVtxo } from '@/types/domain/round'
import type { Vtxo } from '@/types/domain/vtxo'
import type {
  CreateWalletParams,
  CreateWalletResult,
  DeleteWalletParams,
  DeleteWalletResult,
  ExitClaimVtxosParams,
  ExitStartVtxosParams,
  LightningInvoice,
  LightningInvoiceParams,
  OffboardResult,
  OnchainSendParams,
  OnchainSendResult,
  SendParams,
  SendResult,
  UpdateMetadataParams,
  WalletExists
} from '@/types/domain/wallet'

export interface WalletApiBackend {
  arkInfo(): Promise<ArkInfo>
  balance(): Promise<Balance>
  address(): Promise<string>
  mnemonic(): Promise<string>
  vtxos(params?: { all?: boolean }): Promise<Vtxo[]>
  vtxoEncoded(id: string): Promise<string>
  nextRound(): Promise<NextRoundStart>
  pendingRounds(): Promise<PendingRound[]>
  // `null` when nothing was submitted, so callers can tell a registered round
  // apart from a no-op (an empty id list). barkd always registers a
  // participation and never returns null.
  refreshAll(): Promise<PendingRound | null>
  refreshVtxos(params: { vtxos: string[] }): Promise<PendingRound | null>
  refreshingVtxos(): Promise<RefreshingVtxo[]>
  send(params: SendParams): Promise<SendResult>
  sendOnchain(params: OnchainSendParams): Promise<OffboardResult>
  offboardVtxos(params: { vtxos: string[]; address?: string | null }): Promise<OffboardResult>
  createWallet(params: CreateWalletParams): Promise<CreateWalletResult>
  walletExists(): Promise<WalletExists>
  walletDelete(params: DeleteWalletParams): Promise<DeleteWalletResult>
}

export interface OnchainApiBackend {
  onchainAddress(): Promise<string>
  onchainBalance(): Promise<OnchainBalance>
  onchainSend(params: OnchainSendParams): Promise<OnchainSendResult>
  onchainTransactions(): Promise<WalletTx[]>
  onchainUtxos(): Promise<Utxo[]>
}

export interface HistoryApiBackend {
  list(): Promise<Movement[]>
  updateMetadata(params: UpdateMetadataParams): Promise<void>
}

export interface BoardsApiBackend {
  boardAll(): Promise<PendingBoard>
  boardAmount(params: { amountSats: number }): Promise<PendingBoard>
}

export interface FeesApiBackend {
  onchainFeeRates(): Promise<OnchainFeeRates>
  boardFee(params: { amountSats: number }): Promise<FeeEstimate>
  lightningSendFee(params: { amountSats: number }): Promise<FeeEstimate>
  offboardFee(params: { address: string; vtxos: string[] }): Promise<FeeEstimate>
  sendOnchainFee(params: { address: string; amountSats: number }): Promise<FeeEstimate>
}

export interface LightningApiBackend {
  generateInvoice(params: LightningInvoiceParams): Promise<LightningInvoice>
}

export interface ExitsApiBackend {
  getAllExitStatus(): Promise<ExitTransactionStatus[]>
  exitStartAll(): Promise<ExitStartResult>
  exitStartVtxos(params: ExitStartVtxosParams): Promise<ExitStartResult>
  exitClaimVtxos(params: ExitClaimVtxosParams): Promise<ExitClaimResult>
}

export interface BitcoinApiBackend {
  tip(): Promise<number>
}

export interface NotificationsBackend {
  subscribe(listener: (notification: WalletNotification) => void): () => void
}

export interface Backend {
  walletApi: WalletApiBackend
  boardsApi: BoardsApiBackend
  onchainApi: OnchainApiBackend
  historyApi: HistoryApiBackend
  feesApi: FeesApiBackend
  lightningApi: LightningApiBackend
  exitsApi: ExitsApiBackend
  bitcoinApi: BitcoinApiBackend
  notifications: NotificationsBackend
}
