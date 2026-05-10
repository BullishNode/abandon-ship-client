import { FeesApi, LightningApi, NotificationsApi, OnchainApi, WalletApi } from '@secondts/barkd'
import { config } from '@/config/barkd'

export const walletApi = new WalletApi(config.client)
export const onchainApi = new OnchainApi(config.client)
export const feesApi = new FeesApi(config.client)
export const lightningApi = new LightningApi(config.client)
export const notificationsApi = new NotificationsApi(config.client)
