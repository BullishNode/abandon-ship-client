export const walletKeys = {
  all: ['wallet'] as const,
  autoCreate: () => [...walletKeys.all, 'auto-create'] as const,
  balance: () => [...walletKeys.all, 'balance'] as const,
  exists: () => [...walletKeys.all, 'exists'] as const,
  nextRound: () => [...walletKeys.all, 'next-round'] as const,
  transactions: () => [...walletKeys.all, 'transactions'] as const
}

export const onchainKeys = {
  all: ['onchain'] as const,
  balance: () => [...onchainKeys.all, 'balance'] as const,
  transactions: () => [...onchainKeys.all, 'transactions'] as const
}

export const feeKeys = {
  all: ['fees'] as const,
  lightningReceive: (amountSat: number | undefined) =>
    [...feeKeys.all, 'lightning', 'receive', amountSat] as const,
  lightningSend: (amountSat: number | undefined) =>
    [...feeKeys.all, 'lightning', 'send', amountSat] as const,
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
    [...bitcoinKeys.all, 'price', providerId, currency] as const
}

export const brantaKeys = {
  all: ['branta'] as const,
  verification: (qrCode: string | undefined) => [...brantaKeys.all, 'verification', qrCode] as const
}
