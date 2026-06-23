import type { WalletVtxoInfo } from '@secondts/barkd'
import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { VtxoExitBadge } from '@/components/vtxos/vtxo-exit-badge'
import { VtxoStatusBadge } from '@/components/vtxos/vtxo-status-badge'
import type { VtxoExitPhase } from '@/utils/vtxo'
import { getExpiryTimeLabel, truncateVtxoId } from '@/utils/vtxo'

interface VtxoColumnsOptions {
  t: TFunction
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  tipHeight?: number
  exitPhaseById: Map<string, VtxoExitPhase>
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
  formatSats,
  formatFiat,
  tipHeight,
  exitPhaseById
}: VtxoColumnsOptions): ColumnDef<WalletVtxoInfo>[] {
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
            {getExpiryTimeLabel(row.original.expiryHeight, t, tipHeight)}
          </span>
        </div>
      ),
      header: t('vtxos.columns.expiry'),
      id: 'expiry'
    },
    {
      cell: ({ row }) => {
        const exitPhase = exitPhaseById.get(row.original.id)
        if (exitPhase !== undefined) {
          return <VtxoExitBadge phase={exitPhase} />
        }
        return <VtxoStatusBadge status={row.original.state.type} />
      },
      header: t('vtxos.columns.status'),
      id: 'status'
    },
    {
      cell: ({ row }) => (
        <div className="flex flex-col items-end leading-tight">
          <span className="font-medium tabular-nums">{formatSats(row.original.amountSat)}</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatFiat(row.original.amountSat)}
          </span>
        </div>
      ),
      header: () => <div className="text-right">{t('vtxos.columns.amount')}</div>,
      id: 'amount'
    }
  ]
}
