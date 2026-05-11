import { Badge } from '@/components/ui/badge'
import { useMetadataStore } from '@/stores/metadata'

interface OnchainLabelCellProps {
  outpoint: string
  fallback: string
}

export function OnchainLabelCell({ outpoint, fallback }: OnchainLabelCellProps) {
  const annotation = useMetadataStore((state) => state.onchainAnnotations[outpoint])
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
