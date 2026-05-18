import { useEffect } from 'react'
import { useNotifications } from '@/hooks/barkd/use-notifications'
import { useWalletTransactions } from '@/hooks/barkd/use-wallet-transactions'
import { useMetadataStore } from '@/stores/metadata'

export function useMetadataMatcher(): void {
  const matchMovement = useMetadataStore((state) => state.matchMovement)
  const { data: movements } = useWalletTransactions()

  useNotifications((notification) => {
    if (notification.type !== 'movement-created') {
      return
    }
    matchMovement(notification.movement)
  })

  useEffect(() => {
    if (movements === undefined) {
      return
    }
    for (const movement of movements) {
      matchMovement(movement)
    }
  }, [movements, matchMovement])
}
