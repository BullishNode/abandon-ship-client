import type { Movement } from '@secondts/barkd'
import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import { getMovementCounterparty } from '@/utils/movement'

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
      accessorFn: (movement) => getMovementCounterparty(movement),
      header: t('movements.columns.from'),
      id: 'from'
    },
    {
      accessorFn: (movement) => movement.time.createdAt,
      cell: ({ getValue }) => formatDate(getValue<Date>()),
      header: t('movements.columns.date'),
      id: 'date'
    },
    {
      accessorFn: (movement) => movement.effectiveBalanceSat,
      cell: ({ getValue }) => {
        const sats = getValue<number>()
        if (discreteMode) {
          return <span>{formatSats(sats)}</span>
        }
        return (
          <span className={sats >= 0 ? 'text-green-500' : 'text-red-500'}>
            {sats >= 0 ? '+' : ''}
            {formatSats(sats)}
          </span>
        )
      },
      header: t('movements.columns.amount_sats'),
      id: 'amountSats'
    },
    {
      accessorFn: (movement) => movement.effectiveBalanceSat,
      cell: ({ getValue }) => {
        const sats = getValue<number>()
        return <span className="text-muted-foreground">{formatFiat(sats)}</span>
      },
      header: t('movements.columns.amount_fiat'),
      id: 'amountFiat'
    }
  ]
}
