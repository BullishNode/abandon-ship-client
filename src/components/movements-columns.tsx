import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { MovementAmountCell } from '@/components/movement-amount-cell'
import { MovementLabelCell } from '@/components/movement-label-cell'
import { MovementSourceBadge } from '@/components/movement-source-badge'
import { MovementStatusBadge } from '@/components/movement-status-badge'
import { OnchainLabelCell } from '@/components/onchain-label-cell'
import { getMovementDisplayBalanceSats } from '@/utils/movement'
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
        const date =
          entry.kind === 'movement' ? entry.movement.createdAt : entry.approximateTimestampMs
        const status = entry.kind === 'movement' ? entry.movement.status : entry.status
        return (
          <div className="flex flex-col gap-1.5 whitespace-normal">
            <div className="flex flex-wrap gap-1 sm:hidden [&_[data-slot=badge]]:max-w-full [&_[data-slot=badge]]:whitespace-normal">
              <MovementSourceBadge source={getFeedRowSource(entry)} />
              <MovementStatusBadge status={status} />
            </div>
            <span>{formatDate(new Date(date))}</span>
          </div>
        )
      },
      header: t('movements.columns.date'),
      id: 'date'
    },
    {
      cell: ({ row }) => {
        const entry = row.original
        if (entry.kind === 'movement') {
          return <MovementLabelCell movement={entry.movement} />
        }
        return <OnchainLabelCell bindingAddress={entry.bindingAddress} txid={entry.txid} />
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
          entry.kind === 'movement'
            ? getMovementDisplayBalanceSats(entry.movement)
            : entry.amountSat
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
