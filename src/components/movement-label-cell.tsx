import { Badge } from '@/components/ui/badge'
import type { Movement } from '@/types/domain/movement'
import { getMovementMetadata } from '@/utils/metadata'

interface MovementLabelCellProps {
  movement: Movement
}

export function MovementLabelCell({ movement }: MovementLabelCellProps) {
  const metadata = getMovementMetadata(movement)
  const label = metadata?.label?.trim() ?? ''
  const tags = metadata?.tags ?? []
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label.length > 0 ? <span className="text-foreground">{label}</span> : null}
      {tags.map((tag) => (
        <Badge key={tag} variant="muted">
          {tag}
        </Badge>
      ))}
    </div>
  )
}
