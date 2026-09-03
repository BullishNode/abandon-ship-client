import { describe, expect, it } from 'vitest'
import type { Vtxo } from '@/types/domain/vtxo'
import type { VtxoExitState } from './vtxo'
import { sortVtxosForDisplay } from './vtxo'

function makeVtxo(id: string, expiryHeight: number, stateType: Vtxo['state']['type']): Vtxo {
  return {
    amountSats: 1000,
    expiryHeight,
    id,
    state: { type: stateType }
  }
}

describe(sortVtxosForDisplay, () => {
  it('orders live VTXOs by expiry, then exited, then spent', () => {
    const vtxos = [
      makeVtxo('spent-late', 300, 'spent'),
      makeVtxo('exited-a', 50, 'exited'),
      makeVtxo('live-late', 200, 'spendable'),
      makeVtxo('spent-early', 100, 'spent'),
      makeVtxo('live-early', 150, 'locked'),
      makeVtxo('exited-b', 60, 'exited')
    ]
    const exitStateById = new Map<string, VtxoExitState>([
      ['exited-a', 'exited'],
      ['exited-b', 'exited']
    ])
    const exitClaimHeightById = new Map<string, number>([
      ['exited-a', 10],
      ['exited-b', 20]
    ])

    const sorted = sortVtxosForDisplay(vtxos, exitStateById, exitClaimHeightById)

    expect(sorted.map((vtxo) => vtxo.id)).toStrictEqual([
      'live-early',
      'live-late',
      'exited-b',
      'exited-a',
      'spent-late',
      'spent-early'
    ])
  })

  it('keeps exiting VTXOs among live ones', () => {
    const vtxos = [makeVtxo('spent', 10, 'spent'), makeVtxo('exiting', 500, 'spendable')]
    const exitStateById = new Map<string, VtxoExitState>([['exiting', 'exiting']])

    const sorted = sortVtxosForDisplay(vtxos, exitStateById, new Map())

    expect(sorted.map((vtxo) => vtxo.id)).toStrictEqual(['exiting', 'spent'])
  })
})
