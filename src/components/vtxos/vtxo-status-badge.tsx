import { ArrowsClockwiseIcon, HourglassIcon } from '@phosphor-icons/react'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheckIcon } from '@/components/icons/circle-check'
import { CircleLockIcon } from '@/components/icons/circle-lock'
import { CircleMinusIcon } from '@/components/icons/circle-minus'
import { Badge } from '@/components/ui/badge'
import type { VtxoStatus } from '@/utils/vtxo'

const STATUS_CONFIG: Record<
  VtxoStatus,
  { icon: ComponentType<{ className?: string }>; iconClass: string }
> = {
  exited: { icon: CircleCheckIcon, iconClass: 'text-muted-foreground' },
  locked: { icon: CircleLockIcon, iconClass: 'text-amber-500' },
  paid_out: { icon: CircleCheckIcon, iconClass: 'text-blue-500' },
  paying_out: { icon: HourglassIcon, iconClass: 'text-blue-500' },
  renewing: { icon: ArrowsClockwiseIcon, iconClass: 'text-amber-500' },
  spendable: { icon: CircleCheckIcon, iconClass: 'text-green-500' },
  spent: { icon: CircleMinusIcon, iconClass: 'text-muted-foreground' }
}

interface VtxoStatusBadgeProps {
  status: VtxoStatus
  label?: string
}

export function VtxoStatusBadge({ status, label }: VtxoStatusBadgeProps) {
  const { t } = useTranslation()
  const config: (typeof STATUS_CONFIG)[VtxoStatus] | undefined = STATUS_CONFIG[status]
  if (config === undefined) {
    return <Badge variant="outline">{label ?? status ?? '—'}</Badge>
  }
  const Icon = config.icon
  return (
    <Badge variant="outline">
      <Icon className={config.iconClass} />
      {label ?? t(`vtxos.status.${status}`)}
    </Badge>
  )
}
