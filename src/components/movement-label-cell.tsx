import type { Movement } from '@secondts/barkd'
import { Badge } from '@/components/ui/badge'
import { getMovementMetadata } from '@/utils/metadata'

interface MovementLabelCellProps {
  movement: Movement
  fallback?: string
}

export function MovementLabelCell({ movement, fallback }: MovementLabelCellProps) {
  const metadata = getMovementMetadata(movement)
  const label = metadata?.label?.trim() ?? ''
  const tags = metadata?.tags ?? []
  const displayText = label.length > 0 ? label : (fallback ?? '')
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {displayText.length > 0 ? <span className="text-foreground">{displayText}</span> : null}
      {tags.map((tag) => (
        <Badge key={tag} variant="muted">
          {tag}
        </Badge>
      ))}
    </div>
  )
}
