import { CheckCircleIcon, LockIcon, MinusCircleIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { VtxoStatus } from '@/utils/vtxo'

const STATUS_CONFIG: Record<VtxoStatus, { icon: typeof CheckCircleIcon; iconClass: string }> = {
  locked: { icon: LockIcon, iconClass: 'text-amber-500' },
  spendable: { icon: CheckCircleIcon, iconClass: 'text-green-500' },
  spent: { icon: MinusCircleIcon, iconClass: 'text-muted-foreground' }
}

interface VtxoStatusBadgeProps {
  status: VtxoStatus
}

export function VtxoStatusBadge({ status }: VtxoStatusBadgeProps) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge variant="outline">
      <Icon className={config.iconClass} weight="fill" />
      {t(`vtxos.status.${status}`)}
    </Badge>
  )
}
