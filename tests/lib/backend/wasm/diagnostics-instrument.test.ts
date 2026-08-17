import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { instrumentApi, MUTATIONS } from '@/lib/backend/wasm/diagnostics-instrument'
import { createDiagnosticsLog } from '@/lib/backend/wasm/diagnostics-log'

const TXID = 'b'.repeat(64)

function messagesOf(log: { snapshot: () => string[] }): string[] {
  return log.snapshot().map((entry) => entry.slice(entry.indexOf(' ') + 1))
}

// Stub RPC methods resolve through this helper so they contain a real `await`.
// A bare `async () => value` is rewritten by the formatter and then flagged by
// require-await, leaving `npm run fix` oscillating forever.
async function resolves<T>(value: T): Promise<T> {
  return await Promise.resolve(value)
}

// worker.ts calls Comlink.expose at module scope, so its method names are read
// from source rather than by importing it.
function workerApiMethodNames(): Set<string> {
  const source = readFileSync('src/lib/backend/wasm/worker.ts', 'utf-8')
  const body = source.slice(source.indexOf('const api = {'))
  const names = body.matchAll(/^ {2}(?:async )?([a-zA-Z]+)\(/gmu)
  return new Set([...names].map(([, name]) => name))
}

describe(instrumentApi, () => {
  it('logs successful mutations with their arguments and result', async () => {
    const log = createDiagnosticsLog(10)
    const api = instrumentApi(
      { onchainSend: async (_address: string, _amountSats: number) => await resolves(TXID) },
      log
    )
    await api.onchainSend('bc1qexampleaddress', 1500)
    expect(messagesOf(log)).toStrictEqual([`[info] onchainSend(<string:18>, 1500) -> ${TXID}`])
  })

  it('does not log successful reads', async () => {
    const log = createDiagnosticsLog(10)
    const api = instrumentApi({ getBalance: async () => await resolves({ total: 5 }) }, log)
    await api.getBalance()
    expect(log.snapshot()).toStrictEqual([])
  })

  it('logs a rejected read and rethrows the original error', async () => {
    const log = createDiagnosticsLog(10)
    const failure = new Error('ark server unreachable')
    const api = instrumentApi(
      {
        getBalance: async (): Promise<never> => {
          await resolves(null)
          throw failure
        }
      },
      log
    )
    await expect(api.getBalance()).rejects.toBe(failure)
    expect(messagesOf(log)).toStrictEqual(['[error] getBalance failed: ark server unreachable'])
  })

  it('logs a synchronous throw and rethrows it', () => {
    const log = createDiagnosticsLog(10)
    const api = instrumentApi(
      {
        getFingerprint: (): string => {
          throw new Error('Wallet is not open')
        }
      },
      log
    )
    expect(() => api.getFingerprint()).toThrow('Wallet is not open')
    expect(messagesOf(log)).toStrictEqual(['[error] getFingerprint failed: Wallet is not open'])
  })

  it('leaves getDiagnosticsLog uninstrumented so reading never appends', () => {
    const log = createDiagnosticsLog(10)
    const api = instrumentApi({ getDiagnosticsLog: () => log.snapshot() }, log)
    api.getDiagnosticsLog()
    api.getDiagnosticsLog()
    expect(log.snapshot()).toStrictEqual([])
  })

  it('leaves open uninstrumented so the worker owns its richer lines', async () => {
    const log = createDiagnosticsLog(10)
    const api = instrumentApi({ open: async () => await resolves('fingerprint') }, log)
    await api.open()
    expect(log.snapshot()).toStrictEqual([])
  })

  it('returns a stable wrapper across repeated property reads', () => {
    const log = createDiagnosticsLog(10)
    const api = instrumentApi({ getBalance: async () => await resolves(1) }, log)
    expect(api.getBalance).toBe(api.getBalance)
  })

  it('passes non-function properties through untouched', () => {
    const log = createDiagnosticsLog(10)
    const api = instrumentApi({ version: '0.7.2' }, log)
    expect(api.version).toBe('0.7.2')
  })

  it('names only methods that exist on the worker API', () => {
    const methods = workerApiMethodNames()
    const missing = [...MUTATIONS].filter((name) => !methods.has(name))
    expect(missing).toStrictEqual([])
  })

  it('preserves `this` so methods reach their own state', async () => {
    const log = createDiagnosticsLog(10)
    const api = instrumentApi(
      {
        stored: TXID,
        async vtxoEncoded(): Promise<string> {
          return await resolves(this.stored)
        }
      },
      log
    )
    await expect(api.vtxoEncoded()).resolves.toBe(TXID)
  })
})
