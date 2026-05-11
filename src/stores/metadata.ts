import type { Movement } from '@secondts/barkd'
import { z } from 'zod'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { BINDING_TTL_MS, MAX_BINDINGS } from '@/constants/metadata'
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

const STORE_VERSION = 1

interface BindingInput {
  id?: string
  direction: BindingDirection
  destinations: string[]
  label?: string
  tags: string[]
  contactId?: string
}

interface MetadataStore {
  tags: Tag[]
  contacts: Contact[]
  bindings: DestinationBinding[]
  annotations: Record<number, TransactionAnnotation>
  onchainAnnotations: Record<string, OnchainAnnotation>
  addTag: (name: string) => string
  removeTag: (name: string) => void
  addContact: (name: string) => Contact
  removeContact: (id: string) => void
  upsertBinding: (input: BindingInput) => string
  removeBinding: (id: string) => void
  pruneBindings: () => void
  setManualAnnotation: (movementId: number, input: AnnotationInput) => void
  getAnnotation: (movementId: number) => TransactionAnnotation | undefined
  setOnchainAnnotation: (outpoint: string, input: AnnotationInput) => void
  getOnchainAnnotation: (outpoint: string) => OnchainAnnotation | undefined
  matchMovement: (movement: Movement) => void
}

const tagSchema = z.object({
  createdAt: z.string(),
  name: z.string()
}) satisfies z.ZodType<Tag>

const contactSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  name: z.string()
}) satisfies z.ZodType<Contact>

const persistedSchema = z
  .object({
    contacts: z.array(z.unknown()).optional(),
    tags: z.array(z.unknown()).optional()
  })
  .partial()

function parseList<T>(values: unknown[] | undefined, schema: z.ZodType<T>): T[] {
  if (values === undefined) {
    return []
  }
  const out: T[] = []
  for (const value of values) {
    const result = schema.safeParse(value)
    if (result.success) {
      out.push(result.data)
    }
  }
  return out
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
      bindings: [],
      contacts: [],
      getAnnotation: (movementId) => get().annotations[movementId],
      getOnchainAnnotation: (outpoint) => get().onchainAnnotations[outpoint],
      matchMovement: (movement) => {
        const state = get()
        if (state.annotations[movement.id] !== undefined) {
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
        let matched: DestinationBinding | undefined
        for (const binding of state.bindings) {
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
            [movement.id]: buildAnnotation(movement.id, 'binding', {
              contactId: matched.contactId,
              label: matched.label,
              tags: matched.tags
            })
          }
        }))
      },
      onchainAnnotations: {},
      pruneBindings: () => {
        const cutoff = Date.now() - BINDING_TTL_MS
        set((state) => ({
          bindings: state.bindings.filter(
            (binding) => new Date(binding.createdAt).getTime() >= cutoff
          )
        }))
      },
      removeBinding: (id) => {
        set((state) => ({ bindings: state.bindings.filter((binding) => binding.id !== id) }))
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
        set((state) => ({
          annotations: {
            ...state.annotations,
            [movementId]: buildAnnotation(movementId, 'manual', input)
          }
        }))
      },
      setOnchainAnnotation: (outpoint, input) => {
        set((state) => ({
          onchainAnnotations: {
            ...state.onchainAnnotations,
            [outpoint]: buildOnchainAnnotation(outpoint, input)
          }
        }))
      },
      tags: [],
      upsertBinding: (input) => {
        const id = input.id ?? crypto.randomUUID()
        set((state) => {
          const existingIndex = state.bindings.findIndex((binding) => binding.id === id)
          const previous = existingIndex === -1 ? undefined : state.bindings[existingIndex]
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
            const appended = [...state.bindings, next]
            const trimmed =
              appended.length > MAX_BINDINGS
                ? appended.slice(appended.length - MAX_BINDINGS)
                : appended
            return { bindings: trimmed }
          }
          const bindings = [...state.bindings]
          bindings[existingIndex] = next
          return { bindings }
        })
        return id
      }
    }),
    {
      migrate: (persistedState) => {
        const fresh = {
          annotations: {},
          bindings: [],
          contacts: [],
          onchainAnnotations: {},
          tags: []
        }
        const parsed = persistedSchema.safeParse(persistedState)
        if (!parsed.success) {
          return fresh
        }
        return {
          ...fresh,
          contacts: parseList(parsed.data.contacts, contactSchema),
          tags: parseList(parsed.data.tags, tagSchema)
        }
      },
      name: 'bark-web-metadata-store',
      onRehydrateStorage: () => (state) => {
        state?.pruneBindings()
      },
      storage: createJSONStorage(() => localStorage),
      version: STORE_VERSION
    }
  )
)
