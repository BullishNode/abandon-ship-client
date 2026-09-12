import { describe, expect, it } from 'vitest'
import type { RefreshFees } from '@/types/domain/fees'
import type { Vtxo } from '@/types/domain/vtxo'
import { estimateRefreshAllFeeSat } from './refresh'

const refreshFees: RefreshFees = {
  baseFeeSats: 30,
  ppmExpiryTable: [
    { expiryBlocksThreshold: 0, ppm: 0 },
    { expiryBlocksThreshold: 144, ppm: 1000 },
    { expiryBlocksThreshold: 1008, ppm: 5000 }
  ]
}

function makeVtxo(
  amountSats: number,
  expiryHeight: number,
  stateType: 'spendable' | 'spent' = 'spendable'
): Vtxo {
  return {
    amountSats,
    chainAnchor: 'anchor-txid',
    exitDelta: 0,
    expiryHeight,
    id: `vtxo-${expiryHeight}-${amountSats}`,
    policyType: 'pubkey',
    serverPubkey: 'server-pubkey',
    state: { type: stateType },
    userPubkey: 'user-pubkey'
  }
}

describe(estimateRefreshAllFeeSat, () => {
  it('returns undefined when inputs are missing', () => {
    expect(estimateRefreshAllFeeSat(undefined, 100, refreshFees)).toBeUndefined()
    expect(estimateRefreshAllFeeSat([makeVtxo(1000, 200)], undefined, refreshFees)).toBeUndefined()
    expect(estimateRefreshAllFeeSat([makeVtxo(1000, 200)], 100)).toBeUndefined()
  })

  it('returns undefined when there are no spendable vtxos', () => {
    expect(
      estimateRefreshAllFeeSat([makeVtxo(1000, 200, 'spent')], 100, refreshFees)
    ).toBeUndefined()
  })

  it('charges only the base fee for vtxos close to expiry', () => {
    expect(estimateRefreshAllFeeSat([makeVtxo(100_000, 150)], 100, refreshFees)).toBe(30)
  })

  it('applies the ppm tier matching each vtxo expiry distance', () => {
    const vtxos = [makeVtxo(100_000, 600), makeVtxo(100_000, 2000)]
    expect(estimateRefreshAllFeeSat(vtxos, 100, refreshFees)).toBe(30 + 100 + 500)
  })

  it('ignores non-spendable vtxos in the total', () => {
    const vtxos = [makeVtxo(100_000, 600), makeVtxo(100_000, 2000, 'spent')]
    expect(estimateRefreshAllFeeSat(vtxos, 100, refreshFees)).toBe(130)
  })

  it('ignores spendable vtxos that already sit in a round', () => {
    const inRound = makeVtxo(100_000, 2000)
    const vtxos = [makeVtxo(100_000, 600), inRound]
    expect(estimateRefreshAllFeeSat(vtxos, 100, refreshFees, new Set([inRound.id]))).toBe(130)
  })

  it('returns undefined when every spendable vtxo already sits in a round', () => {
    const inRound = makeVtxo(100_000, 600)
    expect(
      estimateRefreshAllFeeSat([inRound], 100, refreshFees, new Set([inRound.id]))
    ).toBeUndefined()
  })
})
