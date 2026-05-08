import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleArkIcon } from '@/components/icons/circle-ark'
import { CircleLightningIcon } from '@/components/icons/circle-lightning'
import { CircleOnchainIcon } from '@/components/icons/circle-onchain'
import { Badge } from '@/components/ui/badge'
import type { MovementSource } from '@/utils/movement'

const SOURCE_ICON: Record<Exclude<MovementSource, 'unknown'>, ComponentType> = {
  ark: CircleArkIcon,
  lightning: CircleLightningIcon,
  onchain: CircleOnchainIcon
}

interface MovementSourceBadgeProps {
  source: MovementSource
}

export function MovementSourceBadge({ source }: MovementSourceBadgeProps) {
  const { t } = useTranslation()
  if (source === 'unknown') {
    return <Badge variant="outline">—</Badge>
  }
  const Icon = SOURCE_ICON[source]
  return (
    <Badge variant="outline">
      <Icon />
      {t(`movements.source.${source}`)}
    </Badge>
  )
}
