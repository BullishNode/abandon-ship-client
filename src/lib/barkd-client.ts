import {
  BitcoinApi,
  BoardsApi,
  ExitsApi,
  FeesApi,
  HistoryApi,
  LightningApi,
  NotificationsApi,
  OnchainApi,
  WalletApi
} from '@secondts/barkd'
import { config } from '@/config/barkd'

export const walletApi = new WalletApi(config.client)
export const boardsApi = new BoardsApi(config.client)
export const historyApi = new HistoryApi(config.client)
export const onchainApi = new OnchainApi(config.client)
export const feesApi = new FeesApi(config.client)
export const lightningApi = new LightningApi(config.client)
export const notificationsApi = new NotificationsApi(config.client)
export const exitsApi = new ExitsApi(config.client)
export const bitcoinApi = new BitcoinApi(config.client)
