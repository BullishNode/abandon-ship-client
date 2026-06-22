import type { WalletVtxoInfo } from '@secondts/barkd'
import type { RowSelectionState } from '@tanstack/react-table'
import { CoinsIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DataTable } from '@/components/data-table'
import { VTXOS_PAGE_SIZE } from '@/constants/vtxos'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { OffboardDialog } from '@/components/vtxos/offboard-dialog'
import { VtxoDetailDialog } from '@/components/vtxos/vtxo-detail-dialog'
import { VtxoSelectionBar } from '@/components/vtxos/vtxo-selection-bar'
import { getVtxoColumns } from '@/components/vtxos/vtxos-columns'
import { useBitcoinTip } from '@/hooks/barkd/use-bitcoin-tip'
import { useRefreshVtxos } from '@/hooks/barkd/use-refresh-vtxos'
import { useVtxos } from '@/hooks/barkd/use-vtxos'
import { usePrivateAmount } from '@/hooks/use-private-amount'
import { isSpendable } from '@/utils/vtxo'

export function VtxosTable() {
  const { t } = useTranslation()
  const { data: vtxos = [], isPending } = useVtxos()
  const { data: tip } = useBitcoinTip()
  const { sats: formatSats, fiat: formatFiat } = usePrivateAmount()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [offboardOpen, setOffboardOpen] = useState(false)
  const [detailVtxo, setDetailVtxo] = useState<WalletVtxoInfo | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const selectedVtxos = vtxos.filter((vtxo) => rowSelection[vtxo.id] && isSpendable(vtxo))
  const selectedIds = selectedVtxos.map((vtxo) => vtxo.id)

  function clearSelection() {
    setRowSelection({})
  }

  const { mutate: refresh, isPending: isRefreshing } = useRefreshVtxos({
    onError: (error) => {
      toast.error(t('vtxos.refresh.error'), { description: error.message })
    },
    onSuccess: () => {
      toast.success(t('vtxos.refresh.success'))
      clearSelection()
    }
  })

  function handleRefresh() {
    refresh({ vtxos: selectedIds })
  }

  function handleRowClick(vtxo: WalletVtxoInfo) {
    setDetailVtxo(vtxo)
    setDetailOpen(true)
  }

  function handleDetailOpenChange(nextOpen: boolean) {
    setDetailOpen(nextOpen)
    if (!nextOpen) {
      setDetailVtxo(null)
    }
  }

  const columns = getVtxoColumns({ formatFiat, formatSats, t, tipHeight: tip?.tipHeight })

  if (isPending) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <>
      <Card className="py-0">
        <CardContent className="px-0 [&_td:first-child]:w-16 [&_td:first-child]:px-6 [&_td:last-child]:pr-6 [&_th:first-child]:w-16 [&_th:first-child]:px-6 [&_th:last-child]:pr-6">
          {vtxos.length === 0 ? (
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
              data={vtxos}
              enableRowSelection={(row) => isSpendable(row.original)}
              getRowId={(vtxo) => vtxo.id}
              onRowClick={handleRowClick}
              onRowSelectionChange={setRowSelection}
              pageSize={VTXOS_PAGE_SIZE}
              rowSelection={rowSelection}
            />
          )}
        </CardContent>
      </Card>
      <VtxoSelectionBar
        count={selectedVtxos.length}
        isBusy={isRefreshing}
        onDeselect={clearSelection}
        onOffboard={() => setOffboardOpen(true)}
        onRefresh={handleRefresh}
      />
      <OffboardDialog
        onOffboarded={clearSelection}
        onOpenChange={setOffboardOpen}
        open={offboardOpen}
        vtxos={selectedVtxos}
      />
      <VtxoDetailDialog
        formatFiat={formatFiat}
        formatSats={formatSats}
        onOpenChange={handleDetailOpenChange}
        open={detailOpen}
        tipHeight={tip?.tipHeight}
        vtxo={detailVtxo}
      />
    </>
  )
}
