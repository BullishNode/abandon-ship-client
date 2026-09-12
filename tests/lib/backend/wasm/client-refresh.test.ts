import type { RoundState } from '@secondts/bark'
import type { wrap } from 'comlink'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Named so the mock keeps the `RoundState | undefined` return type: a bare
// `undefined` argument is stripped by the formatter and stops type-checking.
const noRound: RoundState | undefined = undefined

const workerRemote = vi.hoisted(() => ({
  isOpen: vi.fn<() => Promise<boolean>>(),
  pendingRoundInputVtxoIds: vi.fn<() => Promise<string[]>>(),
  pendingRoundStates: vi.fn<() => Promise<RoundState[]>>(),
  refreshVtxos: vi.fn<(vtxoIds: string[]) => Promise<RoundState | undefined>>(),
  spendableVtxoIds: vi.fn<() => Promise<string[]>>()
}))

// The refresh path under test is pure client-side mapping, so Comlink hands
// back a plain mock. The cast is unavoidable: a mock remote cannot satisfy the
// Remote<T> proxy type `wrap` promises.
vi.mock(import('comlink'), async (importOriginal) => ({
  ...(await importOriginal()),
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  wrap: (() => workerRemote) as unknown as typeof wrap
}))

class WorkerStub {
  terminate = vi.fn<() => void>()
}

vi.stubGlobal('Worker', WorkerStub)

const { wasmBackend } = await import('@/lib/backend/wasm/client')

describe('wasm refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workerRemote.isOpen.mockResolvedValue(true)
    workerRemote.pendingRoundInputVtxoIds.mockResolvedValue([])
    workerRemote.pendingRoundStates.mockResolvedValue([])
  })

  it('returns the submitted round for an explicit selection', async () => {
    workerRemote.refreshVtxos.mockResolvedValue({
      id: 7,
      ongoing: false,
      state: 'awaiting-confirmations'
    })

    const round = await wasmBackend.walletApi.refreshVtxos({ vtxos: ['vtxo-a', 'vtxo-b'] })

    expect(workerRemote.refreshVtxos).toHaveBeenCalledWith(['vtxo-a', 'vtxo-b'])
    expect(round).toStrictEqual({ id: 7, status: { type: 'unconfirmed' } })
  })

  it('reports a no-op refresh as null instead of a fabricated round', async () => {
    workerRemote.refreshVtxos.mockResolvedValue(noRound)

    await expect(wasmBackend.walletApi.refreshVtxos({ vtxos: [] })).resolves.toBeNull()
  })

  it('submits every spendable id for refresh all', async () => {
    workerRemote.spendableVtxoIds.mockResolvedValue(['vtxo-c'])
    workerRemote.refreshVtxos.mockResolvedValue({ id: 9, ongoing: true, state: 'ongoing' })

    const round = await wasmBackend.walletApi.refreshAll()

    expect(workerRemote.refreshVtxos).toHaveBeenCalledWith(['vtxo-c'])
    expect(round).toStrictEqual({ id: 9, status: { type: 'ongoing' } })
  })

  it('leaves vtxos already in a round out of refresh all', async () => {
    workerRemote.spendableVtxoIds.mockResolvedValue(['vtxo-c', 'vtxo-d'])
    workerRemote.pendingRoundInputVtxoIds.mockResolvedValue(['vtxo-c'])
    workerRemote.refreshVtxos.mockResolvedValue({
      id: 10,
      ongoing: false,
      state: 'delegated-pending'
    })

    await wasmBackend.walletApi.refreshAll()

    expect(workerRemote.refreshVtxos).toHaveBeenCalledWith(['vtxo-d'])
  })

  it('reports refresh all as null without a worker hop when nothing is spendable', async () => {
    workerRemote.spendableVtxoIds.mockResolvedValue([])

    await expect(wasmBackend.walletApi.refreshAll()).resolves.toBeNull()
    expect(workerRemote.refreshVtxos).not.toHaveBeenCalled()
  })

  it('reports refresh all as null when every spendable vtxo already sits in a round', async () => {
    workerRemote.spendableVtxoIds.mockResolvedValue(['vtxo-c'])
    workerRemote.pendingRoundInputVtxoIds.mockResolvedValue(['vtxo-c'])

    await expect(wasmBackend.walletApi.refreshAll()).resolves.toBeNull()
    expect(workerRemote.refreshVtxos).not.toHaveBeenCalled()
  })

  it('labels pending inputs queued while no round is past pending', async () => {
    workerRemote.pendingRoundInputVtxoIds.mockResolvedValue(['vtxo-a'])
    workerRemote.pendingRoundStates.mockResolvedValue([
      { id: 1, ongoing: false, state: 'delegated-pending' }
    ])

    await expect(wasmBackend.walletApi.refreshingVtxos()).resolves.toStrictEqual([
      { id: 'vtxo-a', phase: 'queued' }
    ])
  })

  it('labels pending inputs refreshing once a round is ongoing', async () => {
    workerRemote.pendingRoundInputVtxoIds.mockResolvedValue(['vtxo-a'])
    workerRemote.pendingRoundStates.mockResolvedValue([{ id: 1, ongoing: true, state: 'ongoing' }])

    await expect(wasmBackend.walletApi.refreshingVtxos()).resolves.toStrictEqual([
      { id: 'vtxo-a', phase: 'refreshing' }
    ])
  })

  it('ignores a finished round when deriving the phase', async () => {
    workerRemote.pendingRoundInputVtxoIds.mockResolvedValue(['vtxo-a'])
    workerRemote.pendingRoundStates.mockResolvedValue([
      { id: 1, ongoing: false, state: 'delegated-pending' },
      { id: 2, ongoing: false, state: 'failed' },
      { id: 3, ongoing: false, state: 'canceled' }
    ])

    await expect(wasmBackend.walletApi.refreshingVtxos()).resolves.toStrictEqual([
      { id: 'vtxo-a', phase: 'queued' }
    ])
  })
})
