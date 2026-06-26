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
  locked: { icon: CircleLockIcon, iconClass: 'text-amber-500' },
  spendable: { icon: CircleCheckIcon, iconClass: 'text-green-500' },
  spent: { icon: CircleMinusIcon, iconClass: 'text-muted-foreground' }
}

interface VtxoStatusBadgeProps {
  status: VtxoStatus
  label?: string
}

export function VtxoStatusBadge({ status, label }: VtxoStatusBadgeProps) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge variant="outline">
      <Icon className={config.iconClass} />
      {label ?? t(`vtxos.status.${status}`)}
    </Badge>
  )
}
