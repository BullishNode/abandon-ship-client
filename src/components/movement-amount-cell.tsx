import { Skeleton } from '@/components/ui/skeleton'
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
  pending?: boolean
}

function getAmountColorClass(sats: number, discreetMode: boolean): string {
  if (discreetMode) {
    return 'text-foreground'
  }
  return sats > 0 ? 'text-green-500' : 'text-foreground'
}

export function MovementAmountCell({
  sats,
  formatSats,
  formatFiat,
  discreetMode,
  size = 'default',
  align = 'end',
  pending = false
}: MovementAmountCellProps) {
  const sign = sats > 0 ? '+' : ''
  const colorClass = getAmountColorClass(sats, discreetMode)
  const alignClass = align === 'end' ? 'items-end' : 'items-start'

  if (pending) {
    return (
      <div className={cn('flex flex-col gap-1 leading-tight', alignClass)}>
        <Skeleton className={cn('h-4 w-20', size === 'lg' && 'h-7 w-28')} />
        <Skeleton className={cn('h-3 w-12', size === 'lg' && 'h-4 w-16')} />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col leading-tight', alignClass)}>
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
