import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BINDING_TTL_MS, MAX_BINDINGS } from '../../src/constants/metadata'
import { useMetadataStore } from '../../src/stores/metadata'
import { createMovement } from '../fixtures/movements'

function resetStore() {
  useMetadataStore.setState({
    annotations: {},
    bindings: [],
    contacts: [],
    onchainAnnotations: {},
    tags: []
  })
}

describe('metadata store', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('addTag', () => {
    it('trims and adds a new tag', () => {
      const name = useMetadataStore.getState().addTag('  Food  ')
      expect(name).toBe('Food')
      expect(useMetadataStore.getState().tags).toHaveLength(1)
      expect(useMetadataStore.getState().tags[0].name).toBe('Food')
    })

    it('returns the existing tag name on case-insensitive match', () => {
      useMetadataStore.getState().addTag('Food')
      const name = useMetadataStore.getState().addTag('FOOD')
      expect(name).toBe('Food')
      expect(useMetadataStore.getState().tags).toHaveLength(1)
    })

    it('throws when given an empty string', () => {
      expect(() => useMetadataStore.getState().addTag('   ')).toThrow('Tag must not be empty')
    })
  })

  describe('removeTag', () => {
    it('removes by case-insensitive match', () => {
      useMetadataStore.getState().addTag('Food')
      useMetadataStore.getState().removeTag('FOOD')
      expect(useMetadataStore.getState().tags).toHaveLength(0)
    })
  })

  describe('addContact', () => {
    it('trims and assigns an id', () => {
      const contact = useMetadataStore.getState().addContact('  Alice  ')
      expect(contact.name).toBe('Alice')
      expect(contact.id).toBeTruthy()
      expect(useMetadataStore.getState().contacts).toHaveLength(1)
    })

    it('throws on empty input', () => {
      expect(() => useMetadataStore.getState().addContact('  ')).toThrow(
        'Contact name must not be empty'
      )
    })
  })

  describe('removeContact', () => {
    it('removes a contact by id', () => {
      const a = useMetadataStore.getState().addContact('Alice')
      useMetadataStore.getState().addContact('Bob')
      useMetadataStore.getState().removeContact(a.id)
      expect(useMetadataStore.getState().contacts).toHaveLength(1)
      expect(useMetadataStore.getState().contacts[0].name).toBe('Bob')
    })
  })

  describe('upsertBinding', () => {
    it('creates a new binding with a fresh id and dedupes destinations', () => {
      const id = useMetadataStore.getState().upsertBinding({
        destinations: ['a', 'a', '', 'b'],
        direction: 'incoming',
        tags: ['t1']
      })
      const binding = useMetadataStore.getState().bindings.find((b) => b.id === id)
      expect(binding?.destinations).toStrictEqual(['a', 'b'])
    })

    it('merges destinations when an existing id is provided', () => {
      const id = useMetadataStore.getState().upsertBinding({
        destinations: ['a'],
        direction: 'outgoing',
        tags: []
      })
      useMetadataStore.getState().upsertBinding({
        destinations: ['b'],
        direction: 'outgoing',
        id,
        tags: []
      })
      const binding = useMetadataStore.getState().bindings.find((b) => b.id === id)
      expect(binding?.destinations).toStrictEqual(['a', 'b'])
    })

    it('caps total stored bindings at MAX_BINDINGS', () => {
      for (let i = 0; i < MAX_BINDINGS + 5; i += 1) {
        useMetadataStore.getState().upsertBinding({
          destinations: [`addr-${i}`],
          direction: 'incoming',
          tags: []
        })
      }
      expect(useMetadataStore.getState().bindings).toHaveLength(MAX_BINDINGS)
      expect(useMetadataStore.getState().bindings[0].destinations[0]).toBe('addr-5')
    })
  })

  describe('removeBinding', () => {
    it('removes the binding with the given id', () => {
      const id = useMetadataStore.getState().upsertBinding({
        destinations: ['a'],
        direction: 'incoming',
        tags: []
      })
      useMetadataStore.getState().removeBinding(id)
      expect(useMetadataStore.getState().bindings).toHaveLength(0)
    })
  })

  describe('pruneBindings', () => {
    const NOW = new Date('2026-05-13T00:00:00Z')

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(NOW)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('drops bindings older than BINDING_TTL_MS', () => {
      useMetadataStore.setState({
        bindings: [
          {
            createdAt: new Date(NOW.getTime() - BINDING_TTL_MS - 1).toISOString(),
            destinations: ['a'],
            direction: 'incoming',
            id: '1',
            tags: []
          },
          {
            createdAt: NOW.toISOString(),
            destinations: ['b'],
            direction: 'incoming',
            id: '2',
            tags: []
          }
        ]
      })
      useMetadataStore.getState().pruneBindings()
      expect(useMetadataStore.getState().bindings.map((b) => b.id)).toStrictEqual(['2'])
    })
  })

  describe('setManualAnnotation / getAnnotation', () => {
    it('roundtrips a manual annotation', () => {
      useMetadataStore.getState().setManualAnnotation(42, { label: 'Coffee', tags: ['food'] })
      const annotation = useMetadataStore.getState().getAnnotation(42)
      expect(annotation?.label).toBe('Coffee')
      expect(annotation?.source).toBe('manual')
      expect(annotation?.movementId).toBe(42)
    })

    it('returns undefined for unknown movement', () => {
      expect(useMetadataStore.getState().getAnnotation(999)).toBeUndefined()
    })
  })

  describe('setOnchainAnnotation / getOnchainAnnotation', () => {
    it('roundtrips an onchain annotation', () => {
      useMetadataStore.getState().setOnchainAnnotation('tx:0', { label: 'cold', tags: [] })
      expect(useMetadataStore.getState().getOnchainAnnotation('tx:0')?.label).toBe('cold')
    })
  })

  describe('matchMovement', () => {
    it('skips when an annotation already exists', () => {
      useMetadataStore.getState().setManualAnnotation(1, { label: 'manual', tags: [] })
      useMetadataStore.getState().upsertBinding({
        destinations: ['addr-a'],
        direction: 'incoming',
        label: 'binding',
        tags: []
      })
      useMetadataStore.getState().matchMovement(
        createMovement({
          effectiveBalanceSat: 100,
          id: 1,
          receivedOn: [{ amountSat: 100, destination: { type: 'bitcoin', value: 'addr-a' } }]
        })
      )
      expect(useMetadataStore.getState().getAnnotation(1)?.label).toBe('manual')
    })

    it('skips when direction is null (zero balance)', () => {
      useMetadataStore.getState().upsertBinding({
        destinations: ['addr-a'],
        direction: 'incoming',
        tags: []
      })
      useMetadataStore.getState().matchMovement(
        createMovement({
          effectiveBalanceSat: 0,
          id: 2,
          receivedOn: [{ amountSat: 0, destination: { type: 'bitcoin', value: 'addr-a' } }]
        })
      )
      expect(useMetadataStore.getState().getAnnotation(2)).toBeUndefined()
    })

    it('skips when no binding matches the direction', () => {
      useMetadataStore.getState().upsertBinding({
        destinations: ['addr-a'],
        direction: 'outgoing',
        tags: []
      })
      useMetadataStore.getState().matchMovement(
        createMovement({
          effectiveBalanceSat: 100,
          id: 3,
          receivedOn: [{ amountSat: 100, destination: { type: 'bitcoin', value: 'addr-a' } }]
        })
      )
      expect(useMetadataStore.getState().getAnnotation(3)).toBeUndefined()
    })

    it('picks the newest binding when multiple match', () => {
      useMetadataStore.setState({
        bindings: [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            destinations: ['addr-a'],
            direction: 'incoming',
            id: 'old',
            label: 'old-label',
            tags: []
          },
          {
            createdAt: '2026-05-01T00:00:00.000Z',
            destinations: ['addr-a'],
            direction: 'incoming',
            id: 'new',
            label: 'new-label',
            tags: []
          }
        ]
      })
      useMetadataStore.getState().matchMovement(
        createMovement({
          effectiveBalanceSat: 100,
          id: 5,
          receivedOn: [{ amountSat: 100, destination: { type: 'bitcoin', value: 'addr-a' } }]
        })
      )
      expect(useMetadataStore.getState().getAnnotation(5)?.label).toBe('new-label')
    })
  })
})
