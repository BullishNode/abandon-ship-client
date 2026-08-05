import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheckIcon } from '@/components/icons/circle-check'
import { CircleMinusIcon } from '@/components/icons/circle-minus'
import { CircleSpinnerIcon } from '@/components/icons/circle-spinner'
import { CircleXIcon } from '@/components/icons/circle-x'
import { Badge } from '@/components/ui/badge'
import type { MovementStatus } from '@/types/domain/movement'

const STATUS_CONFIG: Record<
  MovementStatus,
  { icon: ComponentType<{ className?: string }>; iconClass: string }
> = {
  canceled: { icon: CircleMinusIcon, iconClass: 'text-muted-foreground' },
  failed: { icon: CircleXIcon, iconClass: 'text-red-500' },
  pending: { icon: CircleSpinnerIcon, iconClass: 'animate-spin text-muted-foreground' },
  successful: { icon: CircleCheckIcon, iconClass: 'text-green-500' }
}

interface MovementStatusBadgeProps {
  status: MovementStatus
}

export function MovementStatusBadge({ status }: MovementStatusBadgeProps) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge variant="outline">
      <Icon className={config.iconClass} />
      {t(`movements.status.${status}`)}
    </Badge>
  )
}
