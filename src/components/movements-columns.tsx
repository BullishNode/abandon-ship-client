import type { Movement } from '@secondts/barkd'
import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { MovementAmountCell } from '@/components/movement-amount-cell'
import { MovementLabelCell } from '@/components/movement-label-cell'
import { MovementSourceBadge } from '@/components/movement-source-badge'
import { MovementStatusBadge } from '@/components/movement-status-badge'
import { getMovementCounterparty, getMovementSource } from '@/utils/movement'

interface MovementColumnsOptions {
  t: TFunction
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  formatDate: (date: Date) => string
  discreteMode: boolean
}

export function getMovementColumns({
  t,
  formatSats,
  formatFiat,
  formatDate,
  discreteMode
}: MovementColumnsOptions): ColumnDef<Movement>[] {
  return [
    {
      accessorFn: (movement) => movement.time.createdAt,
      cell: ({ getValue }) => formatDate(getValue<Date>()),
      header: t('movements.columns.date'),
      id: 'date'
    },
    {
      cell: ({ row }) => (
        <MovementLabelCell
          fallback={getMovementCounterparty(row.original)}
          movementId={row.original.id}
        />
      ),
      header: t('movements.columns.label'),
      id: 'label'
    },
    {
      cell: ({ row }) => <MovementStatusBadge status={row.original.status} />,
      header: t('movements.columns.status'),
      id: 'status'
    },
    {
      cell: ({ row }) => <MovementSourceBadge source={getMovementSource(row.original)} />,
      header: t('movements.columns.source'),
      id: 'source'
    },
    {
      cell: ({ row }) => (
        <MovementAmountCell
          discreteMode={discreteMode}
          formatFiat={formatFiat}
          formatSats={formatSats}
          sats={row.original.effectiveBalanceSat}
        />
      ),
      header: () => <div className="text-right">{t('movements.columns.amount')}</div>,
      id: 'amount'
    }
  ]
}
