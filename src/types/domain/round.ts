export interface VtxoRequest {
  amountSats: number
  policyType: string
  userPubkey: string
}

export interface RoundParticipation {
  inputs: string[]
  outputs: VtxoRequest[]
}

// `fundingTxid` is optional on `unconfirmed` because the wasm backend reports
// the phase without the txid.
export type RoundStatus =
  | { type: 'sync-error'; error: string }
  | { type: 'confirmed'; fundingTxid: string }
  | { type: 'unconfirmed'; fundingTxid?: string }
  | { type: 'ongoing' }
  | { type: 'pending' }
  | { type: 'failed'; error: string }
  | { type: 'canceled' }

export interface PendingRound {
  id: number
  status: RoundStatus
  // The wasm backend's pendingRoundStates() carries no participation; barkd
  // supplies the full participation/funding shape.
  participation?: RoundParticipation
  fundingTxid?: string | null
  fundingTxHex?: string | null
  unlockHash?: string | null
}

export interface NextRoundStart {
  startTime: string
}

// Where a VTXO sits in the refresh flow. `queued` means the round participation
// is registered but the round has not started; `refreshing` means the round is
// running. barkd locks its round inputs at registration, but a bark delegated
// participation only locks once the server issues the round, so the phase — not
// VTXO state — is the signal that a VTXO is already committed to a round.
export type RefreshPhase = 'queued' | 'refreshing'

export interface RefreshingVtxo {
  id: string
  phase: RefreshPhase
}
