import { cn } from '@/lib/utils'

interface MovementAmountCellProps {
  sats: number
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  discreetMode: boolean
}

function getAmountColorClass(sats: number, discreetMode: boolean): string {
  if (discreetMode) {
    return 'text-foreground'
  }
  return sats >= 0 ? 'text-green-500' : 'text-foreground'
}

export function MovementAmountCell({
  sats,
  formatSats,
  formatFiat,
  discreetMode
}: MovementAmountCellProps) {
  const sign = sats >= 0 ? '+' : ''
  const colorClass = getAmountColorClass(sats, discreetMode)
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className={cn('font-medium tabular-nums', colorClass)}>
        {discreetMode ? formatSats(sats) : `${sign}${formatSats(sats)}`}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{formatFiat(sats)}</span>
    </div>
  )
}
