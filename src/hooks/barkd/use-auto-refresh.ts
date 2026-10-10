import { useEffect, useRef } from 'react'
import { useArkInfo } from '@/hooks/barkd/use-ark-info'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { getExpiredVtxos, useExpiredVtxos } from '@/hooks/barkd/use-expired-vtxos'
import { usePendingRounds } from '@/hooks/barkd/use-pending-rounds'
import { useRefreshVtxos } from '@/hooks/barkd/use-refresh-vtxos'
import { useRefreshingVtxos } from '@/hooks/barkd/use-refreshing-vtxos'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { backendErrorMessage } from '@/lib/error-message'
import { getRefusedVtxoIds, useRefreshFailuresStore } from '@/stores/refresh-failures'
import { useSettingsStore } from '@/stores/settings'
import {
  getExpiringVtxoIds,
  getRefreshThresholdOptions,
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
  const { status: expiryStatus } = useExpiredVtxos()
  const refusedAtHeight = useRefreshFailuresStore((state) => state.refusedAtHeight)
  const addRefusedVtxoIds = useRefreshFailuresStore((state) => state.addRefusedVtxoIds)
  const { mutate: refreshVtxos, isPending: isRefreshing } = useRefreshVtxos({
    onError: async (error) => {
      addRefusedVtxoIds(parseUnusableInputIds(await backendErrorMessage(error)), tip)
    }
  })
  const lastAttemptRef = useRef<{ ids: string; attemptedAt: number }>({ attemptedAt: 0, ids: '' })

  const tipHeight = tip
  const vtxoExpiryDelta = arkInfo?.vtxoExpiryDelta
  const refreshFees = arkInfo?.fees.refresh
  const thresholdOptions = getRefreshThresholdOptions(vtxoExpiryDelta, refreshFees)
  const thresholdBlocks = resolveThresholdBlocks(autoRefreshThresholdBlocks, thresholdOptions)

  const seenFailedRounds = useRef(new Set<number>())

  // The server refuses a coin when the round starts, after the refresh call
  // returned, so refused ids come from the failed rounds (ours or the daemon's).
  useEffect(() => {
    if (tip === undefined) {
      return
    }
    for (const round of pendingRounds ?? []) {
      if (round.status.type !== 'failed' || seenFailedRounds.current.has(round.id)) {
        continue
      }
      seenFailedRounds.current.add(round.id)
      addRefusedVtxoIds(parseUnusableInputIds(round.status.error), tip)
    }
  }, [pendingRounds, tip, addRefusedVtxoIds])

  useEffect(() => {
    // Expired coins are checked against the server first, so a coin it already
    // paid out never lands in a batch (one would fail all the others).
    if (isRefreshing || expiryStatus === 'pending') {
      return
    }
    // Skipped rather than blocking the whole wallet, so one VTXO sitting in a
    // round does not stall auto-refresh for the rest. A coin the server refused
    // would fail the whole batch, so it is skipped too, as is an expired coin
    // whose check failed.
    const excludedIds = new Set([
      ...mapRefreshPhases(refreshingVtxos).keys(),
      ...(expiryStatus === 'failed' && tipHeight !== undefined
        ? getExpiredVtxos(vtxos ?? [], tipHeight).map((vtxo) => vtxo.id)
        : []),
      ...getRefusedVtxoIds(useRefreshFailuresStore.getState().refusedAtHeight, tipHeight)
    ])
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
    const idsKey = `${tipHeight}:${expiringIds.join(',')}`
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
    refusedAtHeight,
    expiryStatus,
    isRefreshing,
    refreshVtxos
  ])
}
