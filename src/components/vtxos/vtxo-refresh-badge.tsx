import { ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { RefreshPhase } from '@/types/domain/round'

const PHASE_ICON_CLASS: Record<RefreshPhase, string> = {
  queued: 'text-blue-500',
  refreshing: 'text-amber-500 animate-spin'
}

interface VtxoRefreshBadgeProps {
  phase: RefreshPhase
}

export function VtxoRefreshBadge({ phase }: VtxoRefreshBadgeProps) {
  const { t } = useTranslation()
  return (
    <Badge variant="outline">
      <ArrowsClockwiseIcon className={PHASE_ICON_CLASS[phase]} />
      {t(`vtxos.status.refresh.${phase}`)}
    </Badge>
  )
}
