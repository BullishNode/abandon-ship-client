import type { Movement } from '@secondts/barkd'
import type { ColumnDef } from '@tanstack/react-table'
import type { TFunction } from 'i18next'
import type { FiatCurrency } from '@/types/price-providers'
import { getMovementCounterparty } from '@/utils/movement'

interface MovementColumnsOptions {
  t: TFunction
  formatBitcoin: (sats: number) => string
  formatFiat: (sats: number) => string
  formatDate: (date: Date) => string
  fiatCurrency: FiatCurrency
}

export function getMovementColumns({
  t,
  formatBitcoin,
  formatFiat,
  formatDate
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
        return (
          <span className={sats >= 0 ? 'text-green-500' : 'text-red-500'}>
            {sats >= 0 ? '+' : ''}
            {formatBitcoin(sats)}
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
