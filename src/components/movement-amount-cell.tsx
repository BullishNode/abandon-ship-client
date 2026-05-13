import { cn } from '@/lib/utils'

interface MovementAmountCellProps {
  sats: number
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  discreteMode: boolean
}

function getAmountColorClass(sats: number, discreteMode: boolean): string {
  if (discreteMode) {
    return 'text-foreground'
  }
  return sats >= 0 ? 'text-green-500' : 'text-foreground'
}

export function MovementAmountCell({
  sats,
  formatSats,
  formatFiat,
  discreteMode
}: MovementAmountCellProps) {
  const sign = sats >= 0 ? '+' : ''
  const colorClass = getAmountColorClass(sats, discreteMode)
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className={cn('font-medium tabular-nums', colorClass)}>
        {discreteMode ? formatSats(sats) : `${sign}${formatSats(sats)}`}
      </span>
      <span className="text-muted-foreground text-xs tabular-nums">{formatFiat(sats)}</span>
    </div>
  )
}
