import type { BrantaMode } from '@/types/branta'

export const walletKeys = {
  all: ['wallet'] as const,
  arkInfo: () => [...walletKeys.all, 'ark-info'] as const,
  balance: () => [...walletKeys.all, 'balance'] as const,
  exists: () => [...walletKeys.all, 'exists'] as const,
  expiredVtxos: (tip: number | undefined, vtxoIds: string[]) =>
    [...walletKeys.expiredVtxosAll(), tip, vtxoIds] as const,
  expiredVtxosAll: () => [...walletKeys.all, 'expired-vtxos'] as const,
  expiryPayouts: () => [...walletKeys.expiredVtxosAll(), 'payouts'] as const,
  mnemonic: () => [...walletKeys.all, 'mnemonic'] as const,
  nextRound: () => [...walletKeys.all, 'next-round'] as const,
  pendingRounds: () => [...walletKeys.all, 'pending-rounds'] as const,
  refreshingVtxos: () => [...walletKeys.all, 'refreshing-vtxos'] as const,
  silentUnlock: () => [...walletKeys.all, 'silent-unlock'] as const,
  transactions: () => [...walletKeys.all, 'transactions'] as const,
  vtxoEncoded: (id: string) => [...walletKeys.all, 'vtxos', id, 'encoded'] as const,
  vtxos: () => [...walletKeys.all, 'vtxos'] as const,
  vtxosAll: () => [...walletKeys.all, 'vtxos', 'all'] as const
}

export const onchainKeys = {
  all: ['onchain'] as const,
  snapshot: () => [...onchainKeys.all, 'snapshot'] as const
}

export const feeKeys = {
  all: ['fees'] as const,
  board: (amountSat: number | undefined) => [...feeKeys.all, 'board', amountSat] as const,
  emergencyExit: (vtxos: string[], destination: string | undefined) =>
    [...feeKeys.all, 'emergency-exit', vtxos, destination] as const,
  lightningSend: (amountSat: number | undefined) =>
    [...feeKeys.all, 'lightning', 'send', amountSat] as const,
  offboard: (address: string | undefined, vtxos: string[]) =>
    [...feeKeys.all, 'offboard', address, vtxos] as const,
  onchainRates: () => [...feeKeys.all, 'onchain', 'rates'] as const,
  onchainSend: (amountSat: number | undefined, address: string | undefined) =>
    [...feeKeys.all, 'onchain', 'send', amountSat, address] as const
}

export const lightningKeys = {
  all: ['lightning'] as const,
  invoice: (amountSat: number | undefined) => [...lightningKeys.all, 'invoice', amountSat] as const
}

export const bitcoinKeys = {
  all: ['bitcoin'] as const,
  price: (providerId: string, currency: string) =>
    [...bitcoinKeys.all, 'price', providerId, currency] as const,
  tip: () => [...bitcoinKeys.all, 'tip'] as const
}

export const brantaKeys = {
  all: ['branta'] as const,
  verification: (qrCode: string | undefined, mode: BrantaMode) =>
    [...brantaKeys.all, 'verification', mode, qrCode] as const
}

export const exitKeys = {
  all: ['exits'] as const,
  status: () => [...exitKeys.all, 'status'] as const
}
