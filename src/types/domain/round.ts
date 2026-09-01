export interface VtxoRequest {
  amountSats: number
  policyType: string
  userPubkey: string
}

export interface RoundParticipation {
  inputs: string[]
  outputs: VtxoRequest[]
}

export type RoundStatus =
  | { type: 'sync-error'; error: string }
  | { type: 'confirmed'; fundingTxid: string }
  | { type: 'unconfirmed'; fundingTxid: string }
  | { type: 'pending' }
  | { type: 'failed'; error: string }
  | { type: 'canceled' }

export interface PendingRound {
  id: number
  // Optional: the WASM backend's pendingRoundStates() supplies only { id,
  // ongoing }. barkd supplies the full participation/status/funding shape.
  status?: RoundStatus
  participation?: RoundParticipation
  ongoing?: boolean
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
// participation does not, so the phase — not VTXO state — is the signal that a
// VTXO is already committed to a round.
export type RefreshPhase = 'queued' | 'refreshing'

export interface RefreshingVtxo {
  id: string
  phase: RefreshPhase
}
