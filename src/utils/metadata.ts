import type { Movement } from '@secondts/barkd'
import type {
  AnnotationInput,
  AnnotationSource,
  BindingDirection,
  TransactionAnnotation
} from '@/types/metadata'

export function dedupeNonEmpty(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    if (value === '' || seen.has(value)) {
      continue
    }
    seen.add(value)
    out.push(value)
  }
  return out
}

export function movementDirection(movement: Movement): BindingDirection | null {
  if (movement.effectiveBalanceSat > 0) {
    return 'incoming'
  }
  if (movement.effectiveBalanceSat < 0) {
    return 'outgoing'
  }
  return null
}

export function movementDestinationValues(
  movement: Movement,
  direction: BindingDirection
): string[] {
  const entries = direction === 'incoming' ? movement.receivedOn : movement.sentTo
  return entries.map((entry) => entry.destination.value).filter((value) => value !== '')
}

export function buildAnnotation(
  movementId: number,
  source: AnnotationSource,
  data: AnnotationInput
): TransactionAnnotation {
  const trimmedLabel = data.label?.trim()
  const hasLabel = trimmedLabel !== undefined && trimmedLabel.length > 0
  return {
    contactId: data.contactId,
    createdAt: new Date().toISOString(),
    label: hasLabel ? trimmedLabel : undefined,
    movementId,
    source,
    tags: data.tags
  }
}
