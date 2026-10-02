import { beforeEach, describe, expect, it, vi } from 'vitest'
import { walletApi } from '../../src/lib/barkd-client'
import { waitForRoundResult } from '../../src/lib/round-result'
import type { PendingRound, RoundStatus } from '@/types/domain/round'
import type { Vtxo } from '@/types/domain/vtxo'

const FAST = { intervalMs: 0 }

function round(status: RoundStatus): PendingRound {
  return { id: 7, status }
}

function vtxo(id: string, type: 'spendable' | 'spent'): Vtxo {
  return { amountSats: 1000, expiryHeight: 100, id, state: { type } }
}

describe(waitForRoundResult, () => {
  const pendingRoundsSpy = vi.spyOn(walletApi, 'pendingRounds')
  const vtxosSpy = vi.spyOn(walletApi, 'vtxos')

  beforeEach(() => {
    pendingRoundsSpy.mockReset()
    vtxosSpy.mockReset()
  })

  it('waits while the round is pending, then reports the server refusal', async () => {
    pendingRoundsSpy
      .mockResolvedValueOnce([round({ type: 'pending' })])
      .mockResolvedValueOnce([round({ error: 'unusable inputs: [a:0]', type: 'failed' })])
    const result = await waitForRoundResult(round({ type: 'pending' }), ['a:0'], FAST)
    expect(result).toStrictEqual({ error: 'unusable inputs: [a:0]', type: 'failed' })
    expect(pendingRoundsSpy).toHaveBeenCalledTimes(2)
  })

  it('reports done once the funding tx is out', async () => {
    pendingRoundsSpy.mockResolvedValue([round({ fundingTxid: 'f', type: 'unconfirmed' })])
    const result = await waitForRoundResult(round({ type: 'pending' }), ['a:0'], FAST)
    expect(result).toStrictEqual({ type: 'done' })
  })

  it('reads a removed round as failed when its inputs are still spendable', async () => {
    pendingRoundsSpy.mockResolvedValue([])
    vtxosSpy.mockResolvedValue([vtxo('a:0', 'spendable')])
    const result = await waitForRoundResult(round({ type: 'pending' }), ['a:0'], FAST)
    expect(result).toStrictEqual({ type: 'failed' })
  })

  it('reads a removed round as done when its inputs are gone', async () => {
    pendingRoundsSpy.mockResolvedValue([])
    vtxosSpy.mockResolvedValue([vtxo('b:0', 'spendable')])
    const result = await waitForRoundResult(round({ type: 'pending' }), ['a:0'], FAST)
    expect(result).toStrictEqual({ type: 'done' })
  })

  it('gives up after the maximum wait', async () => {
    pendingRoundsSpy.mockResolvedValue([round({ type: 'pending' })])
    const result = await waitForRoundResult(round({ type: 'pending' }), ['a:0'], {
      intervalMs: 0,
      maxWaitMs: 5
    })
    expect(result).toStrictEqual({ type: 'still-pending' })
  })
})
