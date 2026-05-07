import {
  CheckCircleIcon,
  CircleNotchIcon,
  MinusCircleIcon,
  XCircleIcon
} from '@phosphor-icons/react'
import type { MovementStatus } from '@secondts/barkd'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { VariantProps } from 'class-variance-authority'
import type { badgeVariants } from '@/components/ui/badge'

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

const STATUS_CONFIG: Record<
  MovementStatus,
  { variant: BadgeVariant; icon: typeof CheckCircleIcon; iconClass?: string }
> = {
  canceled: { icon: MinusCircleIcon, variant: 'muted' },
  failed: { icon: XCircleIcon, variant: 'destructive' },
  pending: { icon: CircleNotchIcon, iconClass: 'animate-spin', variant: 'pending' },
  successful: { icon: CheckCircleIcon, variant: 'success' }
}

interface MovementStatusBadgeProps {
  status: MovementStatus
}

export function MovementStatusBadge({ status }: MovementStatusBadgeProps) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge variant={config.variant}>
      <Icon className={config.iconClass} weight="fill" />
      {t(`movements.status.${status}`)}
    </Badge>
  )
}
