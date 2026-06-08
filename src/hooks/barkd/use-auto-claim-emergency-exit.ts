import { useEffect, useRef } from 'react'
import { useClaimEmergencyExit } from '@/hooks/barkd/use-claim-emergency-exit'
import { useExitStatus } from '@/hooks/barkd/use-exit-status'
import { useWalletStore } from '@/stores/wallet'
import { resolveAutoClaimDestination, summarizeExits } from '@/utils/exit-progress'

const AUTO_CLAIM_THROTTLE_MS = 30_000

export function useAutoClaimEmergencyExit(): void {
  const { data: exitStatuses } = useExitStatus()
  const pendingExitClaimAddress = useWalletStore((state) => state.pendingExitClaimAddress)
  const { mutate: claimEmergencyExit, isPending: isClaimingExit } = useClaimEmergencyExit()
  const lastAutoClaimRef = useRef<{ claimableCount: number; attemptedAt: number }>({
    attemptedAt: 0,
    claimableCount: 0
  })

  const summary = summarizeExits(exitStatuses ?? [])
  const destination = resolveAutoClaimDestination(summary, pendingExitClaimAddress)
  const claimableCount = summary.claimable

  useEffect(() => {
    if (destination === null || isClaimingExit) {
      return
    }
    const now = Date.now()
    const last = lastAutoClaimRef.current
    if (last.claimableCount === claimableCount && now - last.attemptedAt < AUTO_CLAIM_THROTTLE_MS) {
      return
    }
    lastAutoClaimRef.current = { attemptedAt: now, claimableCount }
    claimEmergencyExit({ destination })
  }, [destination, claimableCount, isClaimingExit, claimEmergencyExit])
}
