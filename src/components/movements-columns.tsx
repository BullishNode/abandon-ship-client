import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { MovementAmountCell } from '@/components/movement-amount-cell'
import { MovementLabelCell } from '@/components/movement-label-cell'
import { MovementSourceBadge } from '@/components/movement-source-badge'
import { MovementStatusBadge } from '@/components/movement-status-badge'
import { OnchainLabelCell } from '@/components/onchain-label-cell'
import { getMovementDefaultLabel } from '@/utils/movement-labels'
import { getFeedRowSource } from '@/utils/movements-feed'
import type { MovementsFeedRow } from '@/utils/movements-feed'

interface MovementColumnsOptions {
  t: TFunction
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  formatDate: (date: Date) => string
  discreetMode: boolean
}

export function getMovementColumns({
  t,
  formatSats,
  formatFiat,
  formatDate,
  discreetMode
}: MovementColumnsOptions): ColumnDef<MovementsFeedRow>[] {
  return [
    {
      cell: ({ row }) => {
        const entry = row.original
        if (entry.kind === 'movement') {
          return formatDate(entry.movement.time.createdAt)
        }
        return formatDate(new Date(entry.approximateTimestampMs))
      },
      header: t('movements.columns.date'),
      id: 'date'
    },
    {
      cell: ({ row }) => {
        const entry = row.original
        if (entry.kind === 'movement') {
          const fallback = getMovementDefaultLabel(entry.movement.subsystem, t)
          return <MovementLabelCell fallback={fallback} movement={entry.movement} />
        }
        return (
          <OnchainLabelCell
            bindingAddress={entry.bindingAddress}
            isCpfp={entry.isCpfp}
            txid={entry.txid}
          />
        )
      },
      header: t('movements.columns.label'),
      id: 'label'
    },
    {
      cell: ({ row }) => {
        const entry = row.original
        const status = entry.kind === 'movement' ? entry.movement.status : entry.status
        return <MovementStatusBadge status={status} />
      },
      header: t('movements.columns.status'),
      id: 'status'
    },
    {
      cell: ({ row }) => <MovementSourceBadge source={getFeedRowSource(row.original)} />,
      header: t('movements.columns.source'),
      id: 'source'
    },
    {
      cell: ({ row }) => {
        const entry = row.original
        const sats =
          entry.kind === 'movement' ? entry.movement.effectiveBalanceSat : entry.amountSat
        const pending = entry.kind === 'onchain' && entry.isOptimistic === true
        return (
          <MovementAmountCell
            discreetMode={discreetMode}
            formatFiat={formatFiat}
            formatSats={formatSats}
            pending={pending}
            sats={sats}
          />
        )
      },
      header: () => <div className="text-right">{t('movements.columns.amount')}</div>,
      id: 'amount'
    }
  ]
}
