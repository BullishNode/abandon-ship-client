import { useEffect, useRef } from 'react'
import { useClaimEmergencyExitVtxos } from '@/hooks/barkd/use-claim-emergency-exit-vtxos'
import { useExitStatus } from '@/hooks/barkd/use-exit-status'
import { useWalletStore } from '@/stores/wallet'
import { resolveClaimGroups } from '@/utils/exit-progress'

const AUTO_CLAIM_THROTTLE_MS = 30_000

function groupsSignature(groups: { destination: string; vtxos: string[] }[]): string {
  return groups
    .map((group) => `${group.destination}:${[...group.vtxos].toSorted().join(',')}`)
    .toSorted()
    .join('|')
}

export function useAutoClaimEmergencyExit(): void {
  const { data: exitStatuses } = useExitStatus()
  const exitClaimAddresses = useWalletStore((state) => state.exitClaimAddresses)
  const { mutate: claimVtxos, isPending: isClaiming } = useClaimEmergencyExitVtxos()
  const lastAttemptRef = useRef<{ signature: string; attemptedAt: number }>({
    attemptedAt: 0,
    signature: ''
  })

  const groups = resolveClaimGroups(exitStatuses ?? [], exitClaimAddresses)
  const signature = groupsSignature(groups)

  useEffect(() => {
    if (groups.length === 0 || isClaiming) {
      return
    }
    const now = Date.now()
    const last = lastAttemptRef.current
    if (last.signature === signature && now - last.attemptedAt < AUTO_CLAIM_THROTTLE_MS) {
      return
    }
    lastAttemptRef.current = { attemptedAt: now, signature }
    for (const group of groups) {
      claimVtxos({ destination: group.destination, vtxos: group.vtxos })
    }
  }, [signature, groups, isClaiming, claimVtxos])
}
