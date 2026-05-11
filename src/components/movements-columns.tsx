import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { MovementAmountCell } from '@/components/movement-amount-cell'
import { MovementLabelCell } from '@/components/movement-label-cell'
import { MovementSourceBadge } from '@/components/movement-source-badge'
import { MovementStatusBadge } from '@/components/movement-status-badge'
import { OnchainLabelCell } from '@/components/onchain-label-cell'
import { formatAddress } from '@/utils/format'
import { getMovementCounterparty, getMovementSource } from '@/utils/movement'
import type { MovementsFeedRow } from '@/utils/movements-feed'

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
}: MovementColumnsOptions): ColumnDef<MovementsFeedRow>[] {
  return [
    {
      cell: ({ row }) => {
        const entry = row.original
        if (entry.kind === 'movement') {
          return formatDate(entry.movement.time.createdAt)
        }
        if (entry.status === 'pending') {
          return t('movements.onchain.pending_date')
        }
        return t('movements.onchain.confirmed_date', { height: entry.confirmationHeight })
      },
      header: t('movements.columns.date'),
      id: 'date'
    },
    {
      cell: ({ row }) => {
        const entry = row.original
        if (entry.kind === 'movement') {
          const fallback =
            entry.movement.subsystem.kind === 'refresh'
              ? t('movements.kinds.refresh')
              : getMovementCounterparty(entry.movement)
          return <MovementLabelCell fallback={fallback} movementId={entry.movement.id} />
        }
        return (
          <OnchainLabelCell
            fallback={t('movements.onchain.label', { txid: formatAddress(entry.txid) })}
            outpoint={entry.outpoint}
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
      cell: ({ row }) => {
        const entry = row.original
        const source = entry.kind === 'movement' ? getMovementSource(entry.movement) : 'onchain'
        return <MovementSourceBadge source={source} />
      },
      header: t('movements.columns.source'),
      id: 'source'
    },
    {
      cell: ({ row }) => {
        const entry = row.original
        const sats =
          entry.kind === 'movement' ? entry.movement.effectiveBalanceSat : entry.amountSat
        return (
          <MovementAmountCell
            discreteMode={discreteMode}
            formatFiat={formatFiat}
            formatSats={formatSats}
            sats={sats}
          />
        )
      },
      header: () => <div className="text-right">{t('movements.columns.amount')}</div>,
      id: 'amount'
    }
  ]
}
