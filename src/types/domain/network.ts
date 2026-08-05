export const NETWORKS = ['mainnet', 'signet', 'mutinynet', 'regtest'] as const

export type Network = (typeof NETWORKS)[number]
