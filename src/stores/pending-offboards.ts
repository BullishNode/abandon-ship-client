import { create } from 'zustand'
import { useWalletStore } from '@/stores/wallet'
import type { PendingOffboard } from '@/types/movements'

const PENDING_OFFBOARD_TTL_MS = 90_000
const EMPTY: PendingOffboard[] = []

interface PendingOffboardsStore {
  byFingerprint: Record<string, PendingOffboard[]>
  add: (txid: string, createdAtMs: number) => void
  reconcile: (knownTxids: string[], nowMs: number) => void
}

function currentFingerprint(): string | undefined {
  return useWalletStore.getState().wallet?.fingerprint
}

export const usePendingOffboardsStore = create<PendingOffboardsStore>()((set) => ({
  add: (txid, createdAtMs) => {
    const fingerprint = currentFingerprint()
    if (fingerprint === undefined) {
      return
    }
    set((state) => {
      const list = state.byFingerprint[fingerprint] ?? []
      if (list.some((item) => item.txid === txid)) {
        return state
      }
      return {
        byFingerprint: {
          ...state.byFingerprint,
          [fingerprint]: [...list, { createdAtMs, txid }]
        }
      }
    })
  },
  byFingerprint: {},
  reconcile: (knownTxids, nowMs) => {
    const fingerprint = currentFingerprint()
    if (fingerprint === undefined) {
      return
    }
    set((state) => {
      const list = state.byFingerprint[fingerprint]
      if (list === undefined || list.length === 0) {
        return state
      }
      const known = new Set(knownTxids)
      const next = list.filter(
        (item) => !known.has(item.txid) && nowMs - item.createdAtMs < PENDING_OFFBOARD_TTL_MS
      )
      if (next.length === list.length) {
        return state
      }
      return { byFingerprint: { ...state.byFingerprint, [fingerprint]: next } }
    })
  }
}))

export function usePendingOffboards(): PendingOffboard[] {
  const fingerprint = useWalletStore((state) => state.wallet?.fingerprint)
  const byFingerprint = usePendingOffboardsStore((state) => state.byFingerprint)
  if (fingerprint === undefined) {
    return EMPTY
  }
  return byFingerprint[fingerprint] ?? EMPTY
}

export function hasPendingOffboards(): boolean {
  const fingerprint = currentFingerprint()
  if (fingerprint === undefined) {
    return false
  }
  const list = usePendingOffboardsStore.getState().byFingerprint[fingerprint]
  return list !== undefined && list.length > 0
}
