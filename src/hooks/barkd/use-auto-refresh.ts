import { useEffect, useRef } from 'react'
import { useArkInfo } from '@/hooks/barkd/use-ark-info'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useRefreshVtxos } from '@/hooks/barkd/use-refresh-vtxos'
import { useRefreshingVtxos } from '@/hooks/barkd/use-refreshing-vtxos'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { useSettingsStore } from '@/stores/settings'
import {
  getExpiringVtxoIds,
  getRefreshThresholdOptions,
  mapRefreshPhases,
  resolveThresholdBlocks
} from '@/utils/refresh'

const AUTO_REFRESH_THROTTLE_MS = 60_000

export function useAutoRefresh(): void {
  const autoRefreshThresholdBlocks = useSettingsStore((state) => state.autoRefreshThresholdBlocks)
  const { data: vtxos } = useVtxos()
  const { data: tip } = useBitcoinTip()
  const { data: arkInfo } = useArkInfo()
  const { data: refreshingVtxos = [] } = useRefreshingVtxos()
  const { mutate: refreshVtxos, isPending: isRefreshing } = useRefreshVtxos()
  const lastAttemptRef = useRef<{ ids: string; attemptedAt: number }>({ attemptedAt: 0, ids: '' })

  const tipHeight = tip
  const vtxoExpiryDelta = arkInfo?.vtxoExpiryDelta
  const refreshFees = arkInfo?.fees.refresh
  const thresholdOptions = getRefreshThresholdOptions(vtxoExpiryDelta, refreshFees)
  const thresholdBlocks = resolveThresholdBlocks(autoRefreshThresholdBlocks, thresholdOptions)

  useEffect(() => {
    if (isRefreshing) {
      return
    }
    // Skipped rather than blocking the whole wallet, so one VTXO sitting in a
    // round does not stall auto-refresh for the rest.
    const inRoundIds = new Set(mapRefreshPhases(refreshingVtxos).keys())
    const expiringIds = getExpiringVtxoIds(
      vtxos ?? [],
      tipHeight,
      thresholdBlocks,
      vtxoExpiryDelta,
      inRoundIds
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
    isRefreshing,
    refreshVtxos
  ])
}
