import { BARK_WEB_METADATA_KEY } from '@/constants/metadata'
import type { Movement } from '@/types/domain/movement'
import type {
  BarkWebMovementMetadata,
  BindingDirection,
  DestinationBinding,
  OnchainAnnotation,
  OnchainAnnotationInput
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
  if (movement.effectiveBalanceSats > 0) {
    return 'incoming'
  }
  if (movement.effectiveBalanceSats < 0) {
    return 'outgoing'
  }
  return null
}

export function movementDestinationValues(
  movement: Movement,
  direction: BindingDirection
): string[] {
  const entries = direction === 'incoming' ? movement.receivedOn : movement.sentTo
  const values: string[] = []
  for (const entry of entries) {
    const { value } = entry
    if (value !== '') {
      values.push(value)
    }
  }
  return values
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      out.push(item)
    }
  }
  return out
}

export function getMovementMetadata(movement: Movement): BarkWebMovementMetadata | undefined {
  const raw = movement.metadata?.[BARK_WEB_METADATA_KEY]
  if (!isPlainObject(raw)) {
    return undefined
  }
  const result: BarkWebMovementMetadata = {}
  if (typeof raw.label === 'string') {
    result.label = raw.label
  }
  const tags = readStringArray(raw.tags)
  if (tags !== undefined) {
    result.tags = tags
  }
  if (typeof raw.contactId === 'string') {
    result.contactId = raw.contactId
  }
  if (typeof raw.updatedAt === 'string') {
    result.updatedAt = raw.updatedAt
  }
  return result
}

export interface MovementMetadataPatch {
  label?: string | null
  tags?: string[] | null
  contactId?: string | null
}

export function buildMovementMetadataPatchBody(
  patch: MovementMetadataPatch
): Record<string, unknown> {
  const inner: Record<string, unknown> = {}
  if ('label' in patch) {
    inner.label = patch.label === undefined ? null : patch.label
  }
  if ('tags' in patch) {
    inner.tags = patch.tags === undefined ? null : patch.tags
  }
  if ('contactId' in patch) {
    inner.contactId = patch.contactId === undefined ? null : patch.contactId
  }
  inner.updatedAt = new Date().toISOString()
  return { [BARK_WEB_METADATA_KEY]: inner }
}

export function buildOnchainAnnotation(
  txid: string,
  data: OnchainAnnotationInput
): OnchainAnnotation {
  const trimmedLabel = data.label?.trim()
  const hasLabel = trimmedLabel !== undefined && trimmedLabel.length > 0
  return {
    createdAt: new Date().toISOString(),
    label: hasLabel ? trimmedLabel : undefined,
    tags: data.tags,
    txid
  }
}

export interface BindingPromotion {
  bindingId: string
  movementId: number
  metadata: BarkWebMovementMetadata
}

function bindingToMetadata(binding: DestinationBinding): BarkWebMovementMetadata {
  const trimmedLabel = binding.label?.trim()
  const hasLabel = trimmedLabel !== undefined && trimmedLabel.length > 0
  return {
    contactId: binding.contactId,
    label: hasLabel ? trimmedLabel : undefined,
    tags: binding.tags
  }
}

export function computeBindingPromotions(
  movements: Movement[],
  bindings: DestinationBinding[]
): BindingPromotion[] {
  if (bindings.length === 0) {
    return []
  }
  const promotions: BindingPromotion[] = []
  const consumed = new Set<string>()
  for (const movement of movements) {
    if (getMovementMetadata(movement) !== undefined) {
      continue
    }
    const direction = movementDirection(movement)
    if (direction === null) {
      continue
    }
    const destinations = movementDestinationValues(movement, direction)
    if (destinations.length === 0) {
      continue
    }
    const destinationSet = new Set(destinations)
    let matched: DestinationBinding | undefined
    for (const binding of bindings) {
      if (consumed.has(binding.id) || binding.direction !== direction) {
        continue
      }
      if (!binding.destinations.some((value) => destinationSet.has(value))) {
        continue
      }
      if (matched === undefined || binding.createdAt > matched.createdAt) {
        matched = binding
      }
    }
    if (matched === undefined) {
      continue
    }
    consumed.add(matched.id)
    promotions.push({
      bindingId: matched.id,
      metadata: bindingToMetadata(matched),
      movementId: movement.id
    })
  }
  return promotions
}

export function applyBindingPromotions(
  movements: Movement[],
  promotions: BindingPromotion[]
): Movement[] {
  if (promotions.length === 0) {
    return movements
  }
  const byId = new Map<number, BarkWebMovementMetadata>()
  for (const promotion of promotions) {
    byId.set(promotion.movementId, promotion.metadata)
  }
  return movements.map((movement) => {
    const promoted = byId.get(movement.id)
    if (promoted === undefined) {
      return movement
    }
    return {
      ...movement,
      metadata: {
        ...movement.metadata,
        [BARK_WEB_METADATA_KEY]: { ...promoted, updatedAt: new Date().toISOString() }
      }
    }
  })
}
