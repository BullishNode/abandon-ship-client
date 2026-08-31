import type { RoundState } from '@secondts/bark'
import type { wrap } from 'comlink'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Named so the mock keeps the `RoundState | undefined` return type: a bare
// `undefined` argument is stripped by the formatter and stops type-checking.
const noRound: RoundState | undefined = undefined

const workerRemote = vi.hoisted(() => ({
  isOpen: vi.fn<() => Promise<boolean>>(),
  refreshVtxos: vi.fn<(vtxoIds: string[]) => Promise<RoundState | undefined>>(),
  refreshableVtxoIds: vi.fn<() => Promise<string[]>>()
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
  })

  it('returns the submitted round for an explicit selection', async () => {
    workerRemote.refreshVtxos.mockResolvedValue({ id: 7, ongoing: false })

    const round = await wasmBackend.walletApi.refreshVtxos({ vtxos: ['vtxo-a', 'vtxo-b'] })

    expect(workerRemote.refreshVtxos).toHaveBeenCalledWith(['vtxo-a', 'vtxo-b'])
    expect(round).toStrictEqual({ id: 7, ongoing: false })
  })

  it('reports a no-op refresh as null instead of a fabricated round', async () => {
    workerRemote.refreshVtxos.mockResolvedValue(noRound)

    await expect(wasmBackend.walletApi.refreshVtxos({ vtxos: [] })).resolves.toBeNull()
  })

  it('submits the refreshable ids for refresh all', async () => {
    workerRemote.refreshableVtxoIds.mockResolvedValue(['vtxo-c'])
    workerRemote.refreshVtxos.mockResolvedValue({ id: 9, ongoing: true })

    const round = await wasmBackend.walletApi.refreshAll()

    expect(workerRemote.refreshVtxos).toHaveBeenCalledWith(['vtxo-c'])
    expect(round).toStrictEqual({ id: 9, ongoing: true })
  })

  it('reports refresh all as null when nothing is near expiry', async () => {
    workerRemote.refreshableVtxoIds.mockResolvedValue([])
    workerRemote.refreshVtxos.mockResolvedValue(noRound)

    await expect(wasmBackend.walletApi.refreshAll()).resolves.toBeNull()
  })
})
