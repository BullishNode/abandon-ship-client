import type { Movement } from '@/types/domain/movement'

export type WalletNotification =
  | { type: 'movement-created'; movement: Movement }
  | { type: 'movement-updated'; movement: Movement }
  | { type: 'channel-lagging' }
