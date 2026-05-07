import { FeesApi, LightningApi, NotificationsApi, OnchainApi, WalletApi } from '@secondts/barkd'
import { config } from '@/config/barkd'

export const walletApi = new WalletApi(config)
export const onchainApi = new OnchainApi(config)
export const feesApi = new FeesApi(config)
export const lightningApi = new LightningApi(config)
export const notificationsApi = new NotificationsApi(config)
