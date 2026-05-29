export interface Tag {
  name: string
  createdAt: string
}

export interface Contact {
  id: string
  name: string
  createdAt: string
}

export interface BarkWebMovementMetadata {
  label?: string
  tags?: string[]
  contactId?: string
  updatedAt?: string
}

export interface OnchainAnnotation {
  txid: string
  label?: string
  tags: string[]
  createdAt: string
}

export interface OnchainAnnotationInput {
  label?: string
  tags: string[]
}

export type BindingDirection = 'incoming' | 'outgoing'

export interface DestinationBinding {
  id: string
  direction: BindingDirection
  destinations: string[]
  label?: string
  tags: string[]
  contactId?: string
  createdAt: string
}
