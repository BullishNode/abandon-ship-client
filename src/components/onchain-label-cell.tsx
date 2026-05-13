import { Badge } from '@/components/ui/badge'
import { useMetadataStore } from '@/stores/metadata'

interface OnchainLabelCellProps {
  outpoint: string
}

export function OnchainLabelCell({ outpoint }: OnchainLabelCellProps) {
  const annotation = useMetadataStore((state) => state.onchainAnnotations[outpoint])
  const label = annotation?.label?.trim() ?? ''
  const tags = annotation?.tags ?? []
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
