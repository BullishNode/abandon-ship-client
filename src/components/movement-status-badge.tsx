import {
  CheckCircleIcon,
  CircleNotchIcon,
  MinusCircleIcon,
  XCircleIcon
} from '@phosphor-icons/react'
import type { MovementStatus } from '@secondts/barkd'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG: Record<MovementStatus, { icon: typeof CheckCircleIcon; iconClass: string }> = {
  canceled: { icon: MinusCircleIcon, iconClass: 'text-muted-foreground' },
  failed: { icon: XCircleIcon, iconClass: 'text-red-500' },
  pending: { icon: CircleNotchIcon, iconClass: 'animate-spin text-muted-foreground' },
  successful: { icon: CheckCircleIcon, iconClass: 'text-green-500' }
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
      <Icon className={config.iconClass} weight="fill" />
      {t(`movements.status.${status}`)}
    </Badge>
  )
}
