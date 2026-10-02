import { walletApi } from '@/lib/barkd-client'
import type { PendingRound } from '@/types/domain/round'

export type RoundResult =
  | { type: 'done' }
  | { type: 'failed'; error?: string }
  | { type: 'still-pending' }

const POLL_INTERVAL_MS = 5000
const MAX_WAIT_MS = 60 * 60 * 1000

async function sleep(ms: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

// barkd removes a failed or confirmed round from its list on the next daemon
// sync. Once it is gone, inputs still spendable mean the round failed.
async function resultOfRemovedRound(inputIds: string[]): Promise<RoundResult> {
  const vtxos = await walletApi.vtxos()
  const spendableIds = new Set(
    vtxos.filter((vtxo) => vtxo.state.type === 'spendable').map((vtxo) => vtxo.id)
  )
  const isStillThere = inputIds.some((id) => spendableIds.has(id))
  return isStillThere ? { type: 'failed' } : { type: 'done' }
}

function resultOfStatus(status: PendingRound['status']): RoundResult | null {
  if (status.type === 'failed') {
    return { error: status.error, type: 'failed' }
  }
  if (status.type === 'canceled') {
    return { type: 'failed' }
  }
  if (status.type === 'unconfirmed' || status.type === 'confirmed') {
    return { type: 'done' }
  }
  return null
}

// A refresh call only registers a round participation. The server accepts or
// refuses the inputs when the round starts, so wait for that before reporting.
// The input ids are passed in because the wasm backend's rounds carry none.
export async function waitForRoundResult(
  round: PendingRound,
  inputIds: string[],
  { intervalMs = POLL_INTERVAL_MS, maxWaitMs = MAX_WAIT_MS } = {}
): Promise<RoundResult> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    // oxlint-disable-next-line no-await-in-loop
    await sleep(intervalMs)
    // oxlint-disable-next-line no-await-in-loop
    const rounds = await walletApi.pendingRounds()
    const current = rounds.find((candidate) => candidate.id === round.id)
    if (current === undefined) {
      // oxlint-disable-next-line no-await-in-loop
      return await resultOfRemovedRound(inputIds)
    }
    const result = resultOfStatus(current.status)
    if (result !== null) {
      return result
    }
  }
  return { type: 'still-pending' }
}
