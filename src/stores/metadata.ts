import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Contact, Tag } from '@/types/metadata'

interface MetadataStore {
  tags: Tag[]
  addTag: (name: Tag['name']) => Tag['name']
  removeTag: (name: Tag['name']) => void
  contacts: Contact[]
  addContact: (name: Contact['name']) => Contact
  removeContact: (id: Contact['id']) => void
}

export const useMetadataStore = create<MetadataStore>()(
  persist(
    (set, get) => ({
      tags: [],
      contacts: [],
      addTag: (name) => {
        const trimmed = name.trim()
        if (trimmed.length === 0) {
          throw new Error('Tag must not be empty')
        }

        const normalized = trimmed.toLowerCase()
        const existing = get().tags.find(
          (t) => t.name.toLowerCase() === normalized
        )

        if (existing) {
          return existing.name
        }

        const newTag: Tag = {
          name: trimmed,
          createdAt: new Date().toISOString()
        }

        set((state) => ({ tags: [...state.tags, newTag] }))
        return trimmed
      },
      removeTag: (name) => {
        const normalized = name.trim().toLowerCase()
        set((state) => ({
          tags: state.tags.filter(
            (tag) => tag.name.toLowerCase() !== normalized
          )
        }))
      },
      addContact: (name) => {
        const trimmed = name.trim()
        if (trimmed.length === 0) {
          throw new Error('Contact name must not be empty')
        }

        const newContact: Contact = {
          id: crypto.randomUUID(),
          name: trimmed,
          createdAt: new Date().toISOString()
        }

        set((state) => ({ contacts: [...state.contacts, newContact] }))
        return newContact
      },
      removeContact: (id) => {
        set((state) => ({
          contacts: state.contacts.filter((contact) => contact.id !== id)
        }))
      }
    }),
    {
      name: 'bark-web-metadata-store',
      storage: createJSONStorage(() => localStorage)
    }
  )
)
