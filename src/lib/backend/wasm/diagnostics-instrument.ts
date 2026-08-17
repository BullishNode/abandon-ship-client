// Instruments the worker's Comlink RPC surface. Every wallet operation crosses
// this boundary exactly once, so wrapping it here records the whole operation
// history without touching the ~40 method bodies, and without letting a newly
// added method silently escape logging.

import type { DiagnosticsLog } from '@/lib/backend/wasm/diagnostics-log'
import { describeError } from '@/lib/backend/wasm/diagnostics-log'
import { summarizeArgs, summarizeResult } from '@/lib/backend/wasm/diagnostics-redact'

// Successful reads are not logged: the dashboard polls them constantly and they
// would bury the operations that matter. Reads still log their failures.
// Exported so a test can assert every name still exists on the worker API — a
// silent rename here would stop logging an operation with no other symptom.
export const MUTATIONS = new Set([
  'boardAll',
  'boardAmount',
  'claimExits',
  'generateInvoice',
  'offboardVtxos',
  'onchainSend',
  'payInvoice',
  'payLightningAddress',
  'payLnurl',
  'payOffer',
  'refreshVtxos',
  'sendArkoor',
  'sendOnchainFromArk',
  'startExitForEntireWallet',
  'startExitForVtxos'
])

// Reading the log must not append to it, and the open path logs richer lines by hand.
const UNINSTRUMENTED = new Set(['getDiagnosticsLog', 'open'])

function describeCall(method: string, args: readonly unknown[]): string {
  const summary = summarizeArgs(args)
  return summary.length > 0 ? `${method}(${summary})` : method
}

function logSuccess(
  log: DiagnosticsLog,
  method: string,
  args: readonly unknown[],
  result: unknown
): void {
  if (!MUTATIONS.has(method)) {
    return
  }
  const outcome = summarizeResult(result)
  const suffix = outcome.length > 0 ? ` -> ${outcome}` : ''
  log.append('info', `${describeCall(method, args)}${suffix}`)
}

function logFailure(
  log: DiagnosticsLog,
  method: string,
  args: readonly unknown[],
  error: unknown
): void {
  log.append('error', `${describeCall(method, args)} failed: ${describeError(error)}`)
}

function isPromise(value: unknown): value is Promise<unknown> {
  return value instanceof Promise
}

type UnknownFn = (...args: unknown[]) => unknown

function isFunction(value: unknown): value is UnknownFn {
  return typeof value === 'function'
}

async function awaitLogged(
  log: DiagnosticsLog,
  method: string,
  args: readonly unknown[],
  pending: Promise<unknown>
): Promise<unknown> {
  try {
    const value = await pending
    logSuccess(log, method, args, value)
    return value
  } catch (error) {
    logFailure(log, method, args, error)
    throw error
  }
}

// Records sync throws and async rejections alike, then rethrows unchanged so
// callers still observe the original error. The wrapper itself stays synchronous
// so synchronous methods (isOpen, getFingerprint) keep returning plain values.
function instrumentMethod(
  log: DiagnosticsLog,
  method: string,
  fn: UnknownFn,
  target: object
): UnknownFn {
  return (...args: unknown[]) => {
    try {
      const result = Reflect.apply(fn, target, args)
      if (isPromise(result)) {
        return awaitLogged(log, method, args, result)
      }
      logSuccess(log, method, args, result)
      return result
    } catch (error) {
      logFailure(log, method, args, error)
      throw error
    }
  }
}

// Wrappers are memoized because Comlink reads the method on every call, so a
// fresh closure per read would allocate on every RPC.
export function instrumentApi<T extends object>(api: T, log: DiagnosticsLog): T {
  const wrappers = new Map<string, UnknownFn>()

  return new Proxy(api, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (!isFunction(value) || typeof property !== 'string') {
        return value
      }
      if (UNINSTRUMENTED.has(property)) {
        return value
      }
      const cached = wrappers.get(property)
      if (cached !== undefined) {
        return cached
      }
      const wrapper = instrumentMethod(log, property, value, target)
      wrappers.set(property, wrapper)
      return wrapper
    }
  })
}
