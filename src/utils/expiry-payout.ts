import type { ServerVtxoState } from '@/types/domain/expiry-payout'

const SERVER_VTXO_STATES: readonly ServerVtxoState[] = ['spent', 'spendable', 'unregistered']

export function toServerVtxoState(value: unknown): ServerVtxoState {
  return SERVER_VTXO_STATES.find((state) => state === value) ?? 'other'
}
