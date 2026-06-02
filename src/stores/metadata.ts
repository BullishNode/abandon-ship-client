import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { BINDING_TTL_MS, MAX_BINDINGS } from '@/constants/metadata'
import { useWalletStore } from '@/stores/wallet'
import type {
  Contact,
  DestinationBinding,
  OnchainAnnotation,
  OnchainAnnotationInput,
  Tag
} from '@/types/metadata'
import { buildOnchainAnnotation, dedupeNonEmpty } from '@/utils/metadata'

interface BindingInput {
  id?: string
  direction: DestinationBinding['direction']
  destinations: string[]
  label?: string
  tags: string[]
  contactId?: string
}

export interface MetadataStore {
  tags: Tag[]
  contacts: Contact[]
  bindings: Record<string, DestinationBinding[]>
  onchainAnnotations: Record<string, Record<string, OnchainAnnotation>>
  onchainFirstSeen: Record<string, Record<string, string>>
  addTag: (name: string) => string
  removeTag: (name: string) => void
  addContact: (name: string) => Contact
  removeContact: (id: string) => void
  upsertBinding: (input: BindingInput) => string
  removeBinding: (id: string) => void
  pruneBindings: () => void
  setOnchainAnnotation: (txid: string, input: OnchainAnnotationInput) => void
  getOnchainAnnotation: (txid: string) => OnchainAnnotation | undefined
  recordOnchainFirstSeen: (txids: string[]) => void
}

const EMPTY_FIRST_SEEN: Record<string, string> = {}

function getCurrentFingerprint(): string | undefined {
  return useWalletStore.getState().wallet?.fingerprint
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
        const existing = get().tags.find((tag) => tag.name.toLowerCase() === normalized)
        if (existing) {
          return existing.name
        }
        const newTag: Tag = { createdAt: new Date().toISOString(), name: trimmed }
        set((state) => ({ tags: [...state.tags, newTag] }))
        return trimmed
      },
      bindings: {},
      contacts: [],
      getOnchainAnnotation: (txid) => {
        const fp = getCurrentFingerprint()
        const namespace = fp === undefined ? undefined : get().onchainAnnotations[fp]
        return namespace?.[txid]
      },
      onchainAnnotations: {},
      onchainFirstSeen: {},
      pruneBindings: () => {
        const cutoff = Date.now() - BINDING_TTL_MS
        set((state) => {
          const next: Record<string, DestinationBinding[]> = {}
          for (const [fp, list] of Object.entries(state.bindings)) {
            next[fp] = list.filter((binding) => new Date(binding.createdAt).getTime() >= cutoff)
          }
          return { bindings: next }
        })
      },
      recordOnchainFirstSeen: (txids) => {
        const fp = getCurrentFingerprint()
        if (fp === undefined) {
          return
        }
        set((state) => {
          const existing = state.onchainFirstSeen[fp] ?? {}
          const now = new Date().toISOString()
          let changed = false
          const next = { ...existing }
          for (const txid of txids) {
            if (next[txid] === undefined) {
              next[txid] = now
              changed = true
            }
          }
          if (!changed) {
            return state
          }
          return { onchainFirstSeen: { ...state.onchainFirstSeen, [fp]: next } }
        })
      },
      removeBinding: (id) => {
        const fp = getCurrentFingerprint()
        if (fp === undefined) {
          return
        }
        set((state) => {
          const list = state.bindings[fp]
          if (list === undefined) {
            return state
          }
          return {
            bindings: {
              ...state.bindings,
              [fp]: list.filter((binding) => binding.id !== id)
            }
          }
        })
      },
      removeContact: (id) => {
        set((state) => ({ contacts: state.contacts.filter((contact) => contact.id !== id) }))
      },
      removeTag: (name) => {
        const normalized = name.trim().toLowerCase()
        set((state) => ({
          tags: state.tags.filter((tag) => tag.name.toLowerCase() !== normalized)
        }))
      },
      setOnchainAnnotation: (txid, input) => {
        const fp = getCurrentFingerprint()
        if (fp === undefined) {
          return
        }
        set((state) => ({
          onchainAnnotations: {
            ...state.onchainAnnotations,
            [fp]: {
              ...state.onchainAnnotations[fp],
              [txid]: buildOnchainAnnotation(txid, input)
            }
          }
        }))
      },
      tags: [],
      upsertBinding: (input) => {
        const fp = getCurrentFingerprint()
        const id = input.id ?? crypto.randomUUID()
        if (fp === undefined) {
          return id
        }
        set((state) => {
          const list = state.bindings[fp] ?? []
          const existingIndex = list.findIndex((binding) => binding.id === id)
          const previous = existingIndex === -1 ? undefined : list[existingIndex]
          const mergedDestinations = dedupeNonEmpty([
            ...(previous?.destinations ?? []),
            ...input.destinations
          ])
          const next: DestinationBinding = {
            contactId: input.contactId,
            createdAt: previous?.createdAt ?? new Date().toISOString(),
            destinations: mergedDestinations,
            direction: input.direction,
            id,
            label: input.label,
            tags: input.tags
          }
          if (existingIndex === -1) {
            const appended = [...list, next]
            const trimmed =
              appended.length > MAX_BINDINGS
                ? appended.slice(appended.length - MAX_BINDINGS)
                : appended
            return { bindings: { ...state.bindings, [fp]: trimmed } }
          }
          const updated = [...list]
          updated[existingIndex] = next
          return { bindings: { ...state.bindings, [fp]: updated } }
        })
        return id
      }
    }),
    {
      name: 'bark-web-metadata-store',
      onRehydrateStorage: () => (state) => {
        state?.pruneBindings()
      },
      storage: createJSONStorage(() => localStorage),
      version: 1
    }
  )
)

export function useOnchainFirstSeen(): Record<string, string> {
  const fingerprint = useWalletStore((state) => state.wallet?.fingerprint)
  const firstSeen = useMetadataStore((state) => state.onchainFirstSeen)
  if (fingerprint === undefined) {
    return EMPTY_FIRST_SEEN
  }
  return firstSeen[fingerprint] ?? EMPTY_FIRST_SEEN
}
