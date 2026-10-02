import type { RowSelectionState } from '@tanstack/react-table'
import { CaretDownIcon, CoinsIcon, FunnelSimpleIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { EmergencyExitVtxosDialog } from '@/components/vtxos/emergency-exit-vtxos-dialog'
import { OffboardDialog } from '@/components/vtxos/offboard-dialog'
import { VtxoDetailDialog } from '@/components/vtxos/vtxo-detail-dialog'
import { VtxoSelectionBar } from '@/components/vtxos/vtxo-selection-bar'
import { getVtxoColumns } from '@/components/vtxos/vtxos-columns'
import { VTXOS_PAGE_SIZE } from '@/constants/vtxos'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useExitStatus } from '@/hooks/barkd/use-exit-status'
import { useExpiredVtxos } from '@/hooks/barkd/use-expired-vtxos'
import { useRefreshingVtxos } from '@/hooks/barkd/use-refreshing-vtxos'
import { useTrackedRefresh } from '@/hooks/barkd/use-tracked-refresh'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { useLocale } from '@/hooks/use-locale'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { useSettingsStore } from '@/stores/settings'
import { useWalletStore } from '@/stores/wallet'
import type { Vtxo } from '@/types/domain/vtxo'
import { mapRefreshPhases } from '@/utils/refresh'
import {
  isSpendable,
  mapVtxoExitClaimHeights,
  mapVtxoExitPhases,
  mapVtxoExitStates,
  mapVtxoLockLabels,
  sortVtxosForDisplay
} from '@/utils/vtxo'

export function VtxosTable() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { data: vtxos = [], isPending } = useVtxos({ all: true })
  const { data: exitStatuses = [] } = useExitStatus()
  const { data: movements = [] } = useWalletTransactions()
  const { data: tip } = useBitcoinTip()
  const { data: refreshingVtxos = [] } = useRefreshingVtxos()
  const expiredVtxos = useExpiredVtxos()
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()
  const showExitedVtxos = useSettingsStore((state) => state.showExitedVtxos)
  const setShowExitedVtxos = useSettingsStore((state) => state.setShowExitedVtxos)
  const showSpentVtxos = useSettingsStore((state) => state.showSpentVtxos)
  const setShowSpentVtxos = useSettingsStore((state) => state.setShowSpentVtxos)
  const exitClaimAddresses = useWalletStore((state) => state.exitClaimAddresses)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [offboardOpen, setOffboardOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [detailVtxo, setDetailVtxo] = useState<Vtxo | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const exitPhaseById = mapVtxoExitPhases(exitStatuses)
  const exitClaimHeightById = mapVtxoExitClaimHeights(exitStatuses)
  const exitStateById = mapVtxoExitStates(vtxos, exitPhaseById)
  const lockLabelById = mapVtxoLockLabels(vtxos, movements, t)
  const refreshPhaseById = mapRefreshPhases(refreshingVtxos)

  const filteredVtxos = vtxos.filter((vtxo) => {
    const exitState = exitStateById.get(vtxo.id)
    if (exitState === 'exited') {
      return showExitedVtxos
    }
    if (exitState === 'exiting' || expiredVtxos.excludedIds.has(vtxo.id)) {
      return true
    }
    if (vtxo.state.type === 'spent') {
      return showSpentVtxos
    }
    return true
  })
  const visibleVtxos = sortVtxosForDisplay(filteredVtxos, exitStateById, exitClaimHeightById)

  // A VTXO already committed to a round stays `spendable` in bark, so the
  // refresh phase is what keeps it out of a second refresh, offboard or exit.
  function isSelectable(vtxo: Vtxo): boolean {
    return (
      isSpendable(vtxo) &&
      !exitStateById.has(vtxo.id) &&
      !refreshPhaseById.has(vtxo.id) &&
      !expiredVtxos.excludedIds.has(vtxo.id)
    )
  }

  const selectedVtxos = visibleVtxos.filter((vtxo) => rowSelection[vtxo.id] && isSelectable(vtxo))
  const selectedIds = selectedVtxos.map((vtxo) => vtxo.id)
  const prunedSelection: RowSelectionState = Object.fromEntries(selectedIds.map((id) => [id, true]))

  const selectedIdSet = new Set(selectedIds)
  const liveVtxos = vtxos.filter(
    (vtxo) => vtxo.state.type !== 'spent' && !exitStateById.has(vtxo.id)
  )
  const isExitingAll = liveVtxos.length > 0 && liveVtxos.every((vtxo) => selectedIdSet.has(vtxo.id))

  function clearSelection() {
    setRowSelection({})
  }

  const { refresh, isPending: isRefreshing } = useTrackedRefresh(
    {
      done: t('vtxos.refresh.success'),
      failed: t('vtxos.refresh.error'),
      nothing: t('vtxos.refresh.nothing'),
      stillPending: t('vtxos.refresh.still_pending'),
      waiting: t('vtxos.refresh.waiting')
    },
    clearSelection
  )

  function handleRefresh() {
    refresh(selectedIds)
  }

  function handleExitStarted() {
    toast.success(t('vtxos.emergency_exit.success'))
    clearSelection()
  }

  function handleRowClick(vtxo: Vtxo) {
    setDetailVtxo(vtxo)
    setDetailOpen(true)
  }

  function handleDetailOpenChange(nextOpen: boolean) {
    setDetailOpen(nextOpen)
    if (!nextOpen) {
      setDetailVtxo(null)
    }
  }

  const columns = getVtxoColumns({
    exitPhaseById,
    exitStateById,
    formatFiat,
    formatSats,
    locale,
    lockLabelById,
    payoutState: expiredVtxos,
    refreshPhaseById,
    t,
    tipHeight: tip
  })

  if (isPending) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" type="button" variant="outline">
              <FunnelSimpleIcon />
              <span className="hidden sm:inline">{t('vtxos.filters.label')}</span>
              <CaretDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuCheckboxItem
              checked={showExitedVtxos}
              onCheckedChange={(checked) => setShowExitedVtxos(checked)}
              onSelect={(event) => event.preventDefault()}
            >
              {t('vtxos.options.show_exited')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={showSpentVtxos}
              onCheckedChange={(checked) => setShowSpentVtxos(checked)}
              onSelect={(event) => event.preventDefault()}
            >
              {t('vtxos.options.show_spent')}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Card className="py-0">
        <CardContent className="px-0 [&_td:first-child]:w-16 [&_td:first-child]:px-6 [&_td:last-child]:pr-6 [&_th:first-child]:w-16 [&_th:first-child]:px-6 [&_th:last-child]:pr-6">
          {visibleVtxos.length === 0 ? (
            <Empty className="border-0 py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CoinsIcon />
                </EmptyMedia>
                <EmptyTitle>{t('vtxos.empty')}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <DataTable
              columns={columns}
              data={visibleVtxos}
              enableRowSelection={(row) => isSelectable(row.original)}
              getRowId={(vtxo) => vtxo.id}
              onRowClick={handleRowClick}
              onRowSelectionChange={setRowSelection}
              pageSize={VTXOS_PAGE_SIZE}
              rowSelection={prunedSelection}
            />
          )}
        </CardContent>
      </Card>
      <VtxoSelectionBar
        count={selectedVtxos.length}
        isBusy={isRefreshing}
        onDeselect={clearSelection}
        onEmergencyExit={() => setExitOpen(true)}
        onOffboard={() => setOffboardOpen(true)}
        onRefresh={handleRefresh}
      />
      <OffboardDialog
        onOffboarded={clearSelection}
        onOpenChange={setOffboardOpen}
        open={offboardOpen}
        vtxos={selectedVtxos}
      />
      <EmergencyExitVtxosDialog
        isExitingAll={isExitingAll}
        onOpenChange={setExitOpen}
        onStarted={handleExitStarted}
        open={exitOpen}
        vtxos={selectedVtxos}
      />
      <VtxoDetailDialog
        claimAddress={detailVtxo ? exitClaimAddresses[detailVtxo.id] : undefined}
        exitPhase={detailVtxo ? exitPhaseById.get(detailVtxo.id) : undefined}
        exitState={detailVtxo ? exitStateById.get(detailVtxo.id) : undefined}
        formatFiat={formatFiat}
        formatSats={formatSats}
        lockLabel={detailVtxo ? lockLabelById.get(detailVtxo.id) : undefined}
        onOpenChange={handleDetailOpenChange}
        payoutState={expiredVtxos}
        refreshPhase={detailVtxo ? refreshPhaseById.get(detailVtxo.id) : undefined}
        open={detailOpen}
        tipHeight={tip}
        vtxo={detailVtxo}
      />
    </>
  )
}
