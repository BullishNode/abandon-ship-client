import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiagnosticsLevel } from './diagnostics-log'
import { CLAIM_POLL_INTERVAL_MS, claimDelayMs, createClaimWatcher } from './claim-watcher'

const MAX_DELAY_MS = 20_000

function harness() {
  const claimAll = vi.fn<() => Promise<void>>().mockResolvedValue()
  const pendingCount = vi.fn<() => Promise<number>>().mockResolvedValue(1)
  const log = vi.fn<(level: DiagnosticsLevel, message: string) => void>()
  const watcher = createClaimWatcher({
    claimAll,
    log,
    maxDelayMs: MAX_DELAY_MS,
    pendingCount
  })
  return { claimAll, log, pendingCount, watcher }
}

function noop(): void {}

function deferredClaim(): { promise: Promise<void>; release: () => void } {
  let release: () => void = noop
  // oxlint-disable-next-line promise/avoid-new
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

async function tick(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
}

describe(claimDelayMs, () => {
  it('polls at the base interval while claims succeed', () => {
    expect(claimDelayMs(0, MAX_DELAY_MS)).toBe(CLAIM_POLL_INTERVAL_MS)
  })

  it('squares the attempt count and caps at the maximum', () => {
    expect(claimDelayMs(1, MAX_DELAY_MS)).toBe(4000)
    expect(claimDelayMs(2, MAX_DELAY_MS)).toBe(16_000)
    expect(claimDelayMs(3, MAX_DELAY_MS)).toBe(MAX_DELAY_MS)
    expect(claimDelayMs(10, MAX_DELAY_MS)).toBe(MAX_DELAY_MS)
  })
})

describe(createClaimWatcher, () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stops without claiming when nothing is pending', async () => {
    const h = harness()
    h.pendingCount.mockResolvedValue(0)
    h.watcher.start()
    expect(h.watcher.isRunning()).toBeTruthy()
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).not.toHaveBeenCalled()
    expect(h.watcher.isRunning()).toBeFalsy()
  })

  it('claims every base interval while receives are pending', async () => {
    const h = harness()
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    await tick(CLAIM_POLL_INTERVAL_MS)
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).toHaveBeenCalledTimes(3)
    expect(h.watcher.isRunning()).toBeTruthy()
  })

  it('stops once the pending list empties', async () => {
    const h = harness()
    h.pendingCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValue(0)
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    await tick(CLAIM_POLL_INTERVAL_MS)
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).toHaveBeenCalledTimes(2)
    expect(h.watcher.isRunning()).toBeFalsy()
    await tick(MAX_DELAY_MS * 2)
    expect(h.claimAll).toHaveBeenCalledTimes(2)
  })

  it('backs off on repeated failure and caps at the maximum delay', async () => {
    const h = harness()
    h.claimAll.mockRejectedValue(new Error('All 1 lightning receive claim(s) failed'))
    h.watcher.start()
    // Attempt 1 fails: next in 4s.
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).toHaveBeenCalledOnce()
    // Attempt 2 fails: next in 16s.
    await tick(4000)
    expect(h.claimAll).toHaveBeenCalledTimes(2)
    await tick(15_999)
    expect(h.claimAll).toHaveBeenCalledTimes(2)
    // Attempt 3 fails: next capped at 20s.
    await tick(1)
    expect(h.claimAll).toHaveBeenCalledTimes(3)
    await tick(19_999)
    expect(h.claimAll).toHaveBeenCalledTimes(3)
    await tick(1)
    expect(h.claimAll).toHaveBeenCalledTimes(4)
    expect(h.log).toHaveBeenCalledWith('error', expect.stringContaining('attempt 4'))
    expect(h.watcher.isRunning()).toBeTruthy()
  })

  it('resets the backoff after a successful claim', async () => {
    const h = harness()
    h.claimAll.mockRejectedValueOnce(new Error('x')).mockRejectedValueOnce(new Error('x'))
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    await tick(4000)
    await tick(16_000)
    expect(h.claimAll).toHaveBeenCalledTimes(3)
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).toHaveBeenCalledTimes(4)
  })

  it('retries after a failed pending read instead of stopping', async () => {
    const h = harness()
    h.pendingCount.mockRejectedValueOnce(new Error('idb closed'))
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).not.toHaveBeenCalled()
    expect(h.watcher.isRunning()).toBeTruthy()
    expect(h.log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('pending receives read failed')
    )
    await tick(claimDelayMs(1, MAX_DELAY_MS))
    expect(h.claimAll).toHaveBeenCalledOnce()
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).toHaveBeenCalledTimes(2)
  })

  it('backs off across repeated failed pending reads', async () => {
    const h = harness()
    h.pendingCount.mockRejectedValue(new Error('idb closed'))
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    await tick(claimDelayMs(1, MAX_DELAY_MS))
    await tick(claimDelayMs(2, MAX_DELAY_MS) - 1)
    expect(h.pendingCount).toHaveBeenCalledTimes(2)
    await tick(1)
    expect(h.pendingCount).toHaveBeenCalledTimes(3)
    expect(h.claimAll).not.toHaveBeenCalled()
    expect(h.watcher.isRunning()).toBeTruthy()
  })

  it('start is idempotent while running', async () => {
    const h = harness()
    h.watcher.start()
    h.watcher.start()
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).toHaveBeenCalledOnce()
  })

  it('start during a backed-off wait re-arms at the base interval', async () => {
    const h = harness()
    h.claimAll.mockRejectedValueOnce(new Error('x')).mockRejectedValueOnce(new Error('x'))
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    await tick(4000)
    expect(h.claimAll).toHaveBeenCalledTimes(2)
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).toHaveBeenCalledTimes(3)
  })

  it('repeated starts before expiry do not delay the next poll', async () => {
    const h = harness()
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).toHaveBeenCalledOnce()
    await tick(3000)
    h.watcher.start()
    await tick(500)
    h.watcher.start()
    await tick(500)
    expect(h.claimAll).toHaveBeenCalledTimes(2)
  })

  it('start during an in-flight tick does not spawn a second chain', async () => {
    const h = harness()
    const claim = deferredClaim()
    h.claimAll.mockReturnValueOnce(claim.promise)
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).toHaveBeenCalledOnce()
    h.watcher.start()
    claim.release()
    await tick(0)
    await tick(CLAIM_POLL_INTERVAL_MS)
    expect(h.claimAll).toHaveBeenCalledTimes(2)
  })

  it('stop cancels the armed timer', async () => {
    const h = harness()
    h.watcher.start()
    h.watcher.stop()
    await tick(MAX_DELAY_MS * 2)
    expect(h.claimAll).not.toHaveBeenCalled()
    expect(h.watcher.isRunning()).toBeFalsy()
  })

  it('stop during an in-flight tick prevents re-arming', async () => {
    const h = harness()
    const claim = deferredClaim()
    h.claimAll.mockReturnValueOnce(claim.promise)
    h.watcher.start()
    await tick(CLAIM_POLL_INTERVAL_MS)
    h.watcher.stop()
    claim.release()
    await tick(MAX_DELAY_MS * 2)
    expect(h.claimAll).toHaveBeenCalledOnce()
    expect(h.watcher.isRunning()).toBeFalsy()
  })
})
