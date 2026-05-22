import { useEffect } from 'react'
import { useNotifications } from '@/hooks/barkd/use-notifications'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { useMetadataStore } from '@/stores/metadata'
import { useWalletStore } from '@/stores/wallet'

export function useMetadataMatcher(): void {
  const matchMovement = useMetadataStore((state) => state.matchMovement)
  const fingerprint = useWalletStore((state) => state.wallet?.fingerprint)
  const { data: movements } = useWalletTransactions()

  useNotifications((notification) => {
    if (notification.type !== 'movement-created' || fingerprint === undefined) {
      return
    }
    matchMovement(notification.movement)
  })

  useEffect(() => {
    if (movements === undefined || fingerprint === undefined) {
      return
    }
    for (const movement of movements) {
      matchMovement(movement)
    }
  }, [movements, matchMovement, fingerprint])
}
