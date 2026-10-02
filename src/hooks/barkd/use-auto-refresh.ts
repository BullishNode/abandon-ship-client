import { useEffect, useRef } from 'react'
import { useArkInfo } from '@/hooks/barkd/use-ark-info'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { usePendingRounds } from '@/hooks/barkd/use-pending-rounds'
import { useRefreshVtxos } from '@/hooks/barkd/use-refresh-vtxos'
import { useRefreshingVtxos } from '@/hooks/barkd/use-refreshing-vtxos'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { backendErrorMessage } from '@/lib/error-message'
import { useRefreshFailuresStore } from '@/stores/refresh-failures'
import { useSettingsStore } from '@/stores/settings'
import {
  getExpiringVtxoIds,
  getRefreshThresholdOptions,
  getRefusedIdsFromRounds,
  mapRefreshPhases,
  parseUnusableInputIds,
  resolveThresholdBlocks
} from '@/utils/refresh'

const AUTO_REFRESH_THROTTLE_MS = 60_000

export function useAutoRefresh(): void {
  const autoRefreshThresholdBlocks = useSettingsStore((state) => state.autoRefreshThresholdBlocks)
  const { data: vtxos } = useVtxos()
  const { data: tip } = useBitcoinTip()
  const { data: arkInfo } = useArkInfo()
  const { data: refreshingVtxos = [] } = useRefreshingVtxos()
  const { data: pendingRounds } = usePendingRounds()
  const refusedVtxoIds = useRefreshFailuresStore((state) => state.refusedVtxoIds)
  const addRefusedVtxoIds = useRefreshFailuresStore((state) => state.addRefusedVtxoIds)
  const { mutate: refreshVtxos, isPending: isRefreshing } = useRefreshVtxos({
    onError: async (error) => {
      addRefusedVtxoIds(parseUnusableInputIds(await backendErrorMessage(error)))
    }
  })
  const lastAttemptRef = useRef<{ ids: string; attemptedAt: number }>({ attemptedAt: 0, ids: '' })

  const tipHeight = tip
  const vtxoExpiryDelta = arkInfo?.vtxoExpiryDelta
  const refreshFees = arkInfo?.fees.refresh
  const thresholdOptions = getRefreshThresholdOptions(vtxoExpiryDelta, refreshFees)
  const thresholdBlocks = resolveThresholdBlocks(autoRefreshThresholdBlocks, thresholdOptions)

  // The server refuses a coin when the round starts, after the refresh call
  // returned, so refused ids come from the failed rounds (ours or the daemon's).
  useEffect(() => {
    addRefusedVtxoIds(getRefusedIdsFromRounds(pendingRounds ?? []))
  }, [pendingRounds, addRefusedVtxoIds])

  useEffect(() => {
    if (isRefreshing) {
      return
    }
    // Skipped rather than blocking the whole wallet, so one VTXO sitting in a
    // round does not stall auto-refresh for the rest. A coin the server refused
    // would fail the whole batch, so it is skipped too.
    const excludedIds = new Set([...mapRefreshPhases(refreshingVtxos).keys(), ...refusedVtxoIds])
    const expiringIds = getExpiringVtxoIds(
      vtxos ?? [],
      tipHeight,
      thresholdBlocks,
      vtxoExpiryDelta,
      excludedIds
    )
    if (expiringIds.length === 0) {
      return
    }
    const idsKey = expiringIds.join(',')
    const now = Date.now()
    const last = lastAttemptRef.current
    if (last.ids === idsKey && now - last.attemptedAt < AUTO_REFRESH_THROTTLE_MS) {
      return
    }
    lastAttemptRef.current = { attemptedAt: now, ids: idsKey }
    refreshVtxos({ vtxos: expiringIds })
  }, [
    thresholdBlocks,
    vtxos,
    tipHeight,
    vtxoExpiryDelta,
    refreshingVtxos,
    refusedVtxoIds,
    isRefreshing,
    refreshVtxos
  ])
}
