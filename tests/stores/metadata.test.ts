import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BINDING_TTL_MS, MAX_BINDINGS } from '../../src/constants/metadata'
import { useMetadataStore } from '../../src/stores/metadata'
import { useWalletStore } from '../../src/stores/wallet'

const TEST_FP = 'test-fingerprint'

function resetStore() {
  useWalletStore.setState({
    pendingExitClaimAddress: null,
    wallet: { createdAt: '2026-01-01T00:00:00.000Z', fingerprint: TEST_FP, name: 'Test' }
  })
  useMetadataStore.setState({
    bindings: {},
    contacts: [],
    onchainAnnotations: {},
    onchainFirstSeen: {},
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
      const binding = useMetadataStore.getState().bindings[TEST_FP]?.find((b) => b.id === id)
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
      const binding = useMetadataStore.getState().bindings[TEST_FP]?.find((b) => b.id === id)
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
      const walletBindings = useMetadataStore.getState().bindings[TEST_FP] ?? []
      expect(walletBindings).toHaveLength(MAX_BINDINGS)
      expect(walletBindings[0].destinations[0]).toBe('addr-5')
    })

    it('scopes bindings by wallet fingerprint', () => {
      useMetadataStore.getState().upsertBinding({
        destinations: ['addr-a'],
        direction: 'incoming',
        tags: []
      })
      useWalletStore.setState({
        wallet: { createdAt: '2026-01-01T00:00:00.000Z', fingerprint: 'other-fp', name: 'Other' }
      })
      useMetadataStore.getState().upsertBinding({
        destinations: ['addr-b'],
        direction: 'incoming',
        tags: []
      })
      expect(useMetadataStore.getState().bindings[TEST_FP]).toHaveLength(1)
      expect(useMetadataStore.getState().bindings['other-fp']).toHaveLength(1)
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
      expect(useMetadataStore.getState().bindings[TEST_FP] ?? []).toHaveLength(0)
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
        bindings: {
          [TEST_FP]: [
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
        }
      })
      useMetadataStore.getState().pruneBindings()
      expect(useMetadataStore.getState().bindings[TEST_FP]?.map((b) => b.id)).toStrictEqual(['2'])
    })
  })

  describe('setOnchainAnnotation / getOnchainAnnotation', () => {
    it('roundtrips an onchain annotation', () => {
      useMetadataStore.getState().setOnchainAnnotation('tx:0', { label: 'cold', tags: [] })
      expect(useMetadataStore.getState().getOnchainAnnotation('tx:0')?.label).toBe('cold')
    })

    it('isolates onchain annotations by wallet fingerprint', () => {
      useMetadataStore.getState().setOnchainAnnotation('tx:0', { label: 'first', tags: [] })
      useWalletStore.setState({
        wallet: { createdAt: '2026-01-01T00:00:00.000Z', fingerprint: 'other-fp', name: 'Other' }
      })
      expect(useMetadataStore.getState().getOnchainAnnotation('tx:0')).toBeUndefined()
    })
  })

  describe('recordOnchainFirstSeen', () => {
    const NOW = new Date('2026-05-13T00:00:00Z')

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(NOW)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('stamps newly seen txids with the current time', () => {
      useMetadataStore.getState().recordOnchainFirstSeen(['txa', 'txb'])
      expect(useMetadataStore.getState().onchainFirstSeen[TEST_FP]).toStrictEqual({
        txa: NOW.toISOString(),
        txb: NOW.toISOString()
      })
    })

    it('does not overwrite the first-seen time of an already known txid', () => {
      useMetadataStore.getState().recordOnchainFirstSeen(['txa'])
      vi.setSystemTime(new Date('2026-05-13T01:00:00Z'))
      useMetadataStore.getState().recordOnchainFirstSeen(['txa', 'txb'])
      const map = useMetadataStore.getState().onchainFirstSeen[TEST_FP]
      expect(map?.txa).toBe(NOW.toISOString())
      expect(map?.txb).toBe('2026-05-13T01:00:00.000Z')
    })

    it('scopes first-seen records by wallet fingerprint', () => {
      useMetadataStore.getState().recordOnchainFirstSeen(['txa'])
      useWalletStore.setState({
        wallet: { createdAt: '2026-01-01T00:00:00.000Z', fingerprint: 'other-fp', name: 'Other' }
      })
      useMetadataStore.getState().recordOnchainFirstSeen(['txb'])
      expect(
        Object.keys(useMetadataStore.getState().onchainFirstSeen[TEST_FP] ?? {})
      ).toStrictEqual(['txa'])
      expect(
        Object.keys(useMetadataStore.getState().onchainFirstSeen['other-fp'] ?? {})
      ).toStrictEqual(['txb'])
    })
  })
})
