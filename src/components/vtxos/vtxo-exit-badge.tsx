import { ArrowCircleUpIcon, CheckCircleIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { VtxoExitDisplay } from '@/utils/vtxo'

const EXIT_CONFIG: Record<VtxoExitDisplay, { icon: typeof CheckCircleIcon; iconClass: string }> = {
  exited: { icon: CheckCircleIcon, iconClass: 'text-muted-foreground' },
  exiting: { icon: ArrowCircleUpIcon, iconClass: 'text-blue-500' }
}

interface VtxoExitBadgeProps {
  display: VtxoExitDisplay
}

export function VtxoExitBadge({ display }: VtxoExitBadgeProps) {
  const { t } = useTranslation()
  const config = EXIT_CONFIG[display]
  const Icon = config.icon
  return (
    <Badge variant="outline">
      <Icon className={config.iconClass} weight="fill" />
      {t(`vtxos.status.${display}`)}
    </Badge>
  )
}
