export type VtxoState =
  | { type: 'spendable' }
  | { type: 'spent' }
  | { type: 'exited' }
  | { type: 'locked'; movementId?: number; actionId?: string }

export interface Vtxo {
  id: string
  amountSats: number
  expiryHeight: number
  // Optional because the WASM backend's Vtxo surface does not expose these
  // fields; the barkd backend always supplies them.
  exitDelta?: number
  exitDepth?: number | null
  chainAnchor?: string
  policyType?: string
  serverPubkey?: string
  userPubkey?: string
  state: VtxoState
}
