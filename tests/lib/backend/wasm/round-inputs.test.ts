import type { Movement as WasmMovement } from '@secondts/bark'
import { describe, expect, it } from 'vitest'
import { collectPendingRoundInputVtxoIds } from '@/lib/backend/wasm/round-inputs'

function movement(overrides: Partial<WasmMovement>): WasmMovement {
  return {
    completedAt: undefined,
    createdAt: '2026-07-20T00:00:00Z',
    effectiveBalanceSats: 0,
    exitedVtxoIds: [],
    id: 1,
    inputVtxoIds: [],
    intendedBalanceSats: 0,
    lightningInvoice: undefined,
    lightningOffer: undefined,
    metadataJson: '',
    offchainFeeSats: 0,
    outputVtxoIds: [],
    paymentHash: undefined,
    receivedOnAddresses: [],
    sentToAddresses: [],
    status: 'pending',
    subsystemKind: 'refresh',
    subsystemName: 'bark.round',
    updatedAt: '2026-07-20T00:00:00Z',
    ...overrides
  }
}

describe(collectPendingRoundInputVtxoIds, () => {
  it('keeps gating a queued participation whose inputs bark has not locked yet', () => {
    expect(
      collectPendingRoundInputVtxoIds([], [movement({ inputVtxoIds: ['vtxo-a', 'vtxo-b'] })])
    ).toStrictEqual(['vtxo-a', 'vtxo-b'])
  })

  it('unions the locked inputs of an issued round with the queued ones', () => {
    expect(
      collectPendingRoundInputVtxoIds(
        ['vtxo-a'],
        [movement({ id: 2, inputVtxoIds: ['vtxo-a', 'vtxo-b'] })]
      )
    ).toStrictEqual(['vtxo-a', 'vtxo-b'])
  })

  it('ignores movements that are no longer pending', () => {
    const settled = ['successful', 'failed', 'canceled'].map((status, index) =>
      movement({ id: index, inputVtxoIds: [`vtxo-${index}`], status })
    )
    expect(collectPendingRoundInputVtxoIds([], settled)).toStrictEqual([])
  })

  it('ignores pending movements of other subsystems', () => {
    expect(
      collectPendingRoundInputVtxoIds(
        [],
        [
          movement({ inputVtxoIds: ['vtxo-a'], subsystemKind: 'arkoor', subsystemName: 'arkoor' }),
          movement({ id: 2, inputVtxoIds: ['vtxo-b'], subsystemName: 'bark.exit' })
        ]
      )
    ).toStrictEqual([])
  })

  it('gates the inputs of a round-subsystem offboard as well as a refresh', () => {
    expect(
      collectPendingRoundInputVtxoIds(
        [],
        [movement({ inputVtxoIds: ['vtxo-a'], subsystemKind: 'offboard' })]
      )
    ).toStrictEqual(['vtxo-a'])
  })
})
