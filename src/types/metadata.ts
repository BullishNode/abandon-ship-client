export interface Tag {
  name: string
  createdAt: string
}

export interface Contact {
  id: string
  name: string
  createdAt: string
}

export interface TransactionAnnotation {
  txKey: string
  label?: string
  tags: string[]
  contactId?: string
  createdAt: string
}
