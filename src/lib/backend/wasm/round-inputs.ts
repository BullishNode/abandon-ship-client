import type { Movement as WasmMovement } from '@secondts/bark'
import { isRoundSubsystem } from '@/utils/movement'

// bark locks a delegated round's inputs only once the server issues the round,
// so `pendingRoundInputVtxos()` is empty for the whole queued window. The
// guarded round movement exists from before the participation is submitted, so
// its inputs are the only signal covering that window.
export function collectPendingRoundInputVtxoIds(
  lockedInputIds: string[],
  movements: WasmMovement[]
): string[] {
  const ids = new Set(lockedInputIds)
  for (const movement of movements) {
    if (movement.status.toLowerCase() !== 'pending') {
      continue
    }
    if (!isRoundSubsystem({ kind: movement.subsystemKind, name: movement.subsystemName })) {
      continue
    }
    for (const id of movement.inputVtxoIds) {
      ids.add(id)
    }
  }
  return [...ids]
}
