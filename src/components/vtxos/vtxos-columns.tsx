import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { VtxoExitBadge } from '@/components/vtxos/vtxo-exit-badge'
import { VtxoRefreshBadge } from '@/components/vtxos/vtxo-refresh-badge'
import { VtxoStatusBadge } from '@/components/vtxos/vtxo-status-badge'
import type { RefreshPhase } from '@/types/domain/round'
import type { Vtxo } from '@/types/domain/vtxo'
import type { VtxoExitPhase, VtxoExitState } from '@/utils/vtxo'
import { getExpiryTimeLabel, getVtxoStatus, truncateVtxoId } from '@/utils/vtxo'

interface VtxoColumnsOptions {
  t: TFunction
  locale: string
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  tipHeight?: number
  exitPhaseById: Map<string, VtxoExitPhase>
  exitStateById: Map<string, VtxoExitState>
  lockLabelById: Map<string, string>
  refreshPhaseById: Map<string, RefreshPhase>
}

function getHeaderCheckedState(
  allSelected: boolean,
  someSelected: boolean
): boolean | 'indeterminate' {
  if (allSelected) {
    return true
  }
  return someSelected ? 'indeterminate' : false
}

export function getVtxoColumns({
  t,
  locale,
  formatSats,
  formatFiat,
  tipHeight,
  exitPhaseById,
  exitStateById,
  lockLabelById,
  refreshPhaseById
}: VtxoColumnsOptions): ColumnDef<Vtxo>[] {
  return [
    {
      cell: ({ row }) => (
        <Checkbox
          aria-label={t('vtxos.select_row')}
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
          onClick={(event) => event.stopPropagation()}
        />
      ),
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          aria-label={t('vtxos.select_all')}
          checked={getHeaderCheckedState(
            table.getIsAllRowsSelected(),
            table.getIsSomeRowsSelected()
          )}
          onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
        />
      ),
      id: 'select'
    },
    {
      cell: ({ row }) => (
        <span className="font-mono text-xs">{truncateVtxoId(row.original.id)}</span>
      ),
      header: t('vtxos.columns.id'),
      id: 'id'
    },
    {
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight">
          <span className="tabular-nums">{row.original.expiryHeight}</span>
          <span className="text-muted-foreground text-xs">
            {getExpiryTimeLabel(row.original.expiryHeight, t, locale, tipHeight)}
          </span>
        </div>
      ),
      header: t('vtxos.columns.expiry'),
      id: 'expiry'
    },
    {
      cell: ({ row }) => {
        const exitState = exitStateById.get(row.original.id)
        if (exitState !== undefined) {
          return <VtxoExitBadge phase={exitPhaseById.get(row.original.id)} state={exitState} />
        }
        const refreshPhase = refreshPhaseById.get(row.original.id)
        if (refreshPhase !== undefined) {
          return <VtxoRefreshBadge phase={refreshPhase} />
        }
        return (
          <VtxoStatusBadge
            label={lockLabelById.get(row.original.id)}
            status={getVtxoStatus(row.original, tipHeight)}
          />
        )
      },
      header: t('vtxos.columns.status'),
      id: 'status'
    },
    {
      cell: ({ row }) => (
        <div className="flex flex-col items-end leading-tight">
          <span className="font-medium tabular-nums">{formatSats(row.original.amountSats)}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatFiat(row.original.amountSats)}
          </span>
        </div>
      ),
      header: () => <div className="text-right">{t('vtxos.columns.amount')}</div>,
      id: 'amount'
    }
  ]
}
