// A Lightning receive is a parked state machine in bark. `sync()` drives it
// with `wait: false`, one step per call, so the 20s sync loop alone takes
// minutes to settle a payment. This re-drives pending receives at bark's own
// re-drive interval until none are left.

import type { DiagnosticsLevel } from '@/lib/backend/wasm/diagnostics-log'
import { describeError } from '@/lib/backend/wasm/diagnostics-log'

// bark's AWAITING_PAYMENT_POLL_INTERVAL.
export const CLAIM_POLL_INTERVAL_MS = 4000

export interface ClaimWatcherDeps {
  pendingCount: () => Promise<number>
  // Throws only when every pending claim errored: server unreachable, receive
  // failed, or an expired invoice just reaped. A still-unpaid invoice resolves.
  claimAll: () => Promise<void>
  log: (level: DiagnosticsLevel, message: string) => void
  maxDelayMs: number
}

export interface ClaimWatcher {
  start: () => void
  stop: () => void
  isRunning: () => boolean
}

export function claimDelayMs(failures: number, maxDelayMs: number): number {
  if (failures === 0) {
    return CLAIM_POLL_INTERVAL_MS
  }
  return Math.min(CLAIM_POLL_INTERVAL_MS * failures ** 2, maxDelayMs)
}

export function createClaimWatcher(deps: ClaimWatcherDeps): ClaimWatcher {
  // `timer` is null while a tick awaits the wallet; `running` covers that gap
  // so start() cannot spawn a second chain.
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let deadline = 0
  let failures = 0
  // Bumped by stop() so an in-flight tick does not re-arm.
  let generation = 0

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function arm(delayMs: number, own: number, run: (own: number) => Promise<void>): void {
    deadline = Date.now() + delayMs
    timer = setTimeout(() => {
      timer = null
      void run(own)
    }, delayMs)
  }

  // null: the read failed, which must not be mistaken for "nothing pending".
  async function readPendingCount(): Promise<number | null> {
    try {
      return await deps.pendingCount()
    } catch (error) {
      failures += 1
      deps.log(
        'error',
        `claim watcher: pending receives read failed (attempt ${failures}): ${describeError(error)}`
      )
      return null
    }
  }

  async function claim(): Promise<void> {
    try {
      await deps.claimAll()
      failures = 0
    } catch (error) {
      failures += 1
      deps.log(
        'error',
        `claim watcher: claim failed (attempt ${failures}): ${describeError(error)}`
      )
    }
  }

  async function tick(own: number): Promise<void> {
    const pending = await readPendingCount()
    if (own !== generation) {
      return
    }
    if (pending === 0) {
      deps.log('info', 'claim watcher: no pending lightning receives, stopping')
      running = false
      failures = 0
      return
    }
    if (pending !== null) {
      await claim()
    }
    if (own !== generation) {
      return
    }
    arm(claimDelayMs(failures, deps.maxDelayMs), own, tick)
  }

  return {
    isRunning: () => running,
    start: () => {
      failures = 0
      if (running) {
        // Only shorten a backed-off wait; never push out a timer that is
        // already closer than the base interval.
        if (timer !== null && Date.now() + CLAIM_POLL_INTERVAL_MS < deadline) {
          clearTimer()
          arm(CLAIM_POLL_INTERVAL_MS, generation, tick)
        }
        return
      }
      running = true
      deps.log('info', 'claim watcher: started')
      arm(CLAIM_POLL_INTERVAL_MS, generation, tick)
    },
    stop: () => {
      generation += 1
      clearTimer()
      running = false
      failures = 0
    }
  }
}
