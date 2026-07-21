import { ArrowCircleUpIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { CircleCheckIcon } from '@/components/icons/circle-check'
import { Badge } from '@/components/ui/badge'
import type { VtxoExitPhase, VtxoExitState } from '@/utils/vtxo'

const PHASE_LABEL_KEY: Record<VtxoExitPhase, string> = {
  'awaiting-delta': 'awaiting_delta',
  canceled: 'canceled',
  'claim-in-progress': 'claim_in_progress',
  claimable: 'claimable',
  claimed: 'claimed',
  processing: 'processing',
  start: 'start',
  'vtxo-already-spent': 'vtxo_already_spent'
}

interface VtxoExitBadgeProps {
  state: VtxoExitState
  phase?: VtxoExitPhase
}

export function VtxoExitBadge({ state, phase }: VtxoExitBadgeProps) {
  const { t } = useTranslation()
  if (state === 'exited') {
    return (
      <Badge variant="outline">
        <CircleCheckIcon className="text-muted-foreground" />
        {t('vtxos.status.exited')}
      </Badge>
    )
  }
  const phaseLabel = phase === undefined ? '' : t(`vtxos.status.phases.${PHASE_LABEL_KEY[phase]}`)
  return (
    <Badge variant="outline">
      <ArrowCircleUpIcon className="text-blue-500" weight="fill" />
      {t('vtxos.status.exiting', { phase: phaseLabel })}
    </Badge>
  )
}
