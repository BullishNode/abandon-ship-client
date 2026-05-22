import type { Movement } from '@secondts/barkd'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { BINDING_TTL_MS, MAX_BINDINGS } from '@/constants/metadata'
import { useWalletStore } from '@/stores/wallet'
import type {
  AnnotationInput,
  BindingDirection,
  Contact,
  DestinationBinding,
  OnchainAnnotation,
  Tag,
  TransactionAnnotation
} from '@/types/metadata'
import {
  buildAnnotation,
  buildOnchainAnnotation,
  dedupeNonEmpty,
  movementDestinationValues,
  movementDirection
} from '@/utils/metadata'

interface BindingInput {
  id?: string
  direction: BindingDirection
  destinations: string[]
  label?: string
  tags: string[]
  contactId?: string
}

export interface MetadataStore {
  tags: Tag[]
  contacts: Contact[]
  bindings: Record<string, DestinationBinding[]>
  annotations: Record<string, Record<number, TransactionAnnotation>>
  onchainAnnotations: Record<string, Record<string, OnchainAnnotation>>
  addTag: (name: string) => string
  removeTag: (name: string) => void
  addContact: (name: string) => Contact
  removeContact: (id: string) => void
  upsertBinding: (input: BindingInput) => string
  removeBinding: (id: string) => void
  pruneBindings: () => void
  setManualAnnotation: (movementId: number, input: AnnotationInput) => void
  getAnnotation: (movementId: number) => TransactionAnnotation | undefined
  setOnchainAnnotation: (txid: string, input: AnnotationInput) => void
  getOnchainAnnotation: (txid: string) => OnchainAnnotation | undefined
  matchMovement: (movement: Movement) => void
}

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
      annotations: {},
      bindings: {},
      contacts: [],
      getAnnotation: (movementId) => {
        const fp = getCurrentFingerprint()
        const namespace = fp === undefined ? undefined : get().annotations[fp]
        return namespace?.[movementId]
      },
      getOnchainAnnotation: (txid) => {
        const fp = getCurrentFingerprint()
        const namespace = fp === undefined ? undefined : get().onchainAnnotations[fp]
        return namespace?.[txid]
      },
      matchMovement: (movement) => {
        const fp = getCurrentFingerprint()
        if (fp === undefined) {
          return
        }
        const state = get()
        if (state.annotations[fp]?.[movement.id] !== undefined) {
          return
        }
        const direction = movementDirection(movement)
        if (direction === null) {
          return
        }
        const destinations = movementDestinationValues(movement, direction)
        if (destinations.length === 0) {
          return
        }
        const destinationSet = new Set(destinations)
        const walletBindings = state.bindings[fp] ?? []
        let matched: DestinationBinding | undefined
        for (const binding of walletBindings) {
          if (binding.direction !== direction) {
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
          return
        }
        set((current) => ({
          annotations: {
            ...current.annotations,
            [fp]: {
              ...current.annotations[fp],
              [movement.id]: buildAnnotation(movement.id, 'binding', {
                contactId: matched.contactId,
                label: matched.label,
                tags: matched.tags
              })
            }
          }
        }))
      },
      onchainAnnotations: {},
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
      setManualAnnotation: (movementId, input) => {
        const fp = getCurrentFingerprint()
        if (fp === undefined) {
          return
        }
        set((state) => ({
          annotations: {
            ...state.annotations,
            [fp]: {
              ...state.annotations[fp],
              [movementId]: buildAnnotation(movementId, 'manual', input)
            }
          }
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
