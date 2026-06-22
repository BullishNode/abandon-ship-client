import { cn } from '@/lib/utils'

type MovementAmountCellSize = 'default' | 'lg'
type MovementAmountCellAlign = 'start' | 'end'

interface MovementAmountCellProps {
  sats: number
  formatSats: (sats: number) => string
  formatFiat: (sats: number) => string
  discreetMode: boolean
  size?: MovementAmountCellSize
  align?: MovementAmountCellAlign
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
  discreetMode,
  size = 'default',
  align = 'end'
}: MovementAmountCellProps) {
  const sign = sats >= 0 ? '+' : ''
  const colorClass = getAmountColorClass(sats, discreetMode)
  return (
    <div
      className={cn('flex flex-col leading-tight', align === 'end' ? 'items-end' : 'items-start')}
    >
      <span className={cn('font-medium tabular-nums', size === 'lg' && 'text-2xl', colorClass)}>
        {discreetMode ? formatSats(sats) : `${sign}${formatSats(sats)}`}
      </span>
      <span
        className={cn('text-muted-foreground tabular-nums', size === 'lg' ? 'text-sm' : 'text-xs')}
      >
        {formatFiat(sats)}
      </span>
    </div>
  )
}
