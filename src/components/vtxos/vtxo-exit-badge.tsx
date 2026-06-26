import { ArrowCircleUpIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { CircleCheckIcon } from '@/components/icons/circle-check'
import { Badge } from '@/components/ui/badge'
import { isExitedPhase } from '@/utils/vtxo'
import type { VtxoExitPhase } from '@/utils/vtxo'

const PHASE_LABEL_KEY: Record<VtxoExitPhase, string> = {
  'awaiting-delta': 'awaiting_delta',
  'claim-in-progress': 'claim_in_progress',
  claimable: 'claimable',
  claimed: 'claimed',
  processing: 'processing',
  start: 'start'
}

interface VtxoExitBadgeProps {
  phase: VtxoExitPhase
}

export function VtxoExitBadge({ phase }: VtxoExitBadgeProps) {
  const { t } = useTranslation()
  if (isExitedPhase(phase)) {
    return (
      <Badge variant="outline">
        <CircleCheckIcon className="text-muted-foreground" />
        {t('vtxos.status.exited')}
      </Badge>
    )
  }
  return (
    <Badge variant="outline">
      <ArrowCircleUpIcon className="text-blue-500" weight="fill" />
      {t('vtxos.status.exiting', { phase: t(`vtxos.status.phases.${PHASE_LABEL_KEY[phase]}`) })}
    </Badge>
  )
}
