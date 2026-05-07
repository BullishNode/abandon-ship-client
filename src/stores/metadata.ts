import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Contact, Tag, TransactionAnnotation } from '@/types/metadata'

interface MetadataStore {
  tags: Tag[]
  addTag: (name: Tag['name']) => Tag['name']
  removeTag: (name: Tag['name']) => void
  contacts: Contact[]
  addContact: (name: Contact['name']) => Contact
  removeContact: (id: Contact['id']) => void
  annotations: TransactionAnnotation[]
  setAnnotation: (
    txKey: string,
    data: { label?: string; tags: string[]; contactId?: string }
  ) => void
  getAnnotation: (txKey: string) => TransactionAnnotation | undefined
}

export const useMetadataStore = create<MetadataStore>()(
  persist(
    (set, get) => ({
      addContact: (name) => {
        const trimmed = name.trim()
        if (trimmed.length === 0) {
          throw new Error('Contact name must not be empty')
        }

        const newContact: Contact = {
          createdAt: new Date().toISOString(),
          id: crypto.randomUUID(),
          name: trimmed
        }

        set((state) => ({ contacts: [...state.contacts, newContact] }))
        return newContact
      },
      addTag: (name) => {
        const trimmed = name.trim()
        if (trimmed.length === 0) {
          throw new Error('Tag must not be empty')
        }

        const normalized = trimmed.toLowerCase()
        const existing = get().tags.find((t) => t.name.toLowerCase() === normalized)

        if (existing) {
          return existing.name
        }

        const newTag: Tag = {
          createdAt: new Date().toISOString(),
          name: trimmed
        }

        set((state) => ({ tags: [...state.tags, newTag] }))
        return trimmed
      },
      annotations: [],
      contacts: [],
      getAnnotation: (txKey) => get().annotations.find((a) => a.txKey === txKey),
      removeContact: (id) => {
        set((state) => ({
          contacts: state.contacts.filter((contact) => contact.id !== id)
        }))
      },
      removeTag: (name) => {
        const normalized = name.trim().toLowerCase()
        set((state) => ({
          tags: state.tags.filter((tag) => tag.name.toLowerCase() !== normalized)
        }))
      },
      setAnnotation: (txKey, data) => {
        set((state) => {
          const existing = state.annotations.findIndex((a) => a.txKey === txKey)
          const annotation: TransactionAnnotation = {
            ...data,
            createdAt: new Date().toISOString(),
            txKey
          }

          if (existing !== -1) {
            const updated = [...state.annotations]
            updated[existing] = annotation
            return { annotations: updated }
          }

          return { annotations: [...state.annotations, annotation] }
        })
      },
      tags: []
    }),
    {
      name: 'bark-web-metadata-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
