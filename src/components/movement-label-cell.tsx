import { Badge } from '@/components/ui/badge'
import { useMetadataStore } from '@/stores/metadata'

interface MovementLabelCellProps {
  movementId: number
  fallback: string
}

export function MovementLabelCell({ movementId, fallback }: MovementLabelCellProps) {
  const annotation = useMetadataStore((state) => state.annotations[movementId])
  const label = annotation?.label?.trim() ?? ''
  const tags = annotation?.tags ?? []
  const hasLabel = label.length > 0
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={hasLabel ? 'text-foreground' : 'text-muted-foreground'}>
        {hasLabel ? label : fallback}
      </span>
      {tags.map((tag) => (
        <Badge key={tag} variant="muted">
          {tag}
        </Badge>
      ))}
    </div>
  )
}
