export interface Balance {
  spendableSats: number
  pendingInRoundSats: number
  // Null/undefined only while the exit subsystem is momentarily unavailable, not
  // when no exit exists (that returns a real 0). Consumers carry the last known
  // value forward to avoid flicker between polls.
  pendingExitSats?: number | null
  pendingBoardSats: number
  pendingLightningSendSats: number
  claimableLightningReceiveSats: number
  // Optional: only barkd master reports these (the WASM bindings do not yet).
  // `needsRefreshSats` holds expired coins, which master moves out of
  // `spendableSats` until they are refreshed.
  needsRefreshSats?: number
  pendingArkoorSendSats?: number
  pendingOffboardSats?: number
}

export interface OnchainBalance {
  confirmedSats: number
  totalSats: number
  // Optional: the WASM OnchainWallet exposes only confirmed/pending/total. barkd
  // supplies the richer trusted/untrusted breakdown. Consumers fall back to the
  // coarse fields (see src/utils/balance.ts, src/hooks/send/use-send-quote.ts).
  immatureSats?: number
  trustedPendingSats?: number
  trustedSpendableSats?: number
  untrustedPendingSats?: number
}
