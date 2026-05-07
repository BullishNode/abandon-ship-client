import { LightningIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { MovementSource } from '@/utils/movement'

// Placeholder icons: replace with on-chain / lightning / ark variants once available.
const SOURCE_ICON: Record<MovementSource, typeof LightningIcon> = {
  ark: LightningIcon,
  lightning: LightningIcon,
  onchain: LightningIcon,
  unknown: LightningIcon
}

interface MovementSourceBadgeProps {
  source: MovementSource
}

export function MovementSourceBadge({ source }: MovementSourceBadgeProps) {
  const { t } = useTranslation()
  const Icon = SOURCE_ICON[source]
  const label = source === 'unknown' ? '—' : t(`movements.source.${source}`)
  return (
    <Badge variant="outline">
      <Icon weight="fill" />
      {label}
    </Badge>
  )
}
