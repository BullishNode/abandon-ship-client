import { Badge } from '@/components/ui/badge'
import { useMetadataStore } from '@/stores/metadata'
import { useWalletStore } from '@/stores/wallet'

interface MovementLabelCellProps {
  movementId: number
  fallback?: string
}

export function MovementLabelCell({ movementId, fallback }: MovementLabelCellProps) {
  const fingerprint = useWalletStore((state) => state.wallet?.fingerprint)
  const annotation = useMetadataStore((state) =>
    fingerprint === undefined ? undefined : state.annotations[fingerprint]?.[movementId]
  )
  const label = annotation?.label?.trim() ?? ''
  const tags = annotation?.tags ?? []
  const hasLabel = label.length > 0
  const displayText = hasLabel ? label : (fallback ?? '')
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {displayText.length > 0 ? (
        <span className={hasLabel ? 'text-foreground' : 'text-muted-foreground'}>
          {displayText}
        </span>
      ) : null}
      {tags.map((tag) => (
        <Badge key={tag} variant="muted">
          {tag}
        </Badge>
      ))}
    </div>
  )
}
