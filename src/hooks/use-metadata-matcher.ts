import { useNotifications } from '@/hooks/barkd/use-notifications'
import { useMetadataStore } from '@/stores/metadata'

export function useMetadataMatcher(): void {
  const matchMovement = useMetadataStore((state) => state.matchMovement)
  useNotifications((notification) => {
    if (notification.type !== 'movement-created') {
      return
    }
    matchMovement(notification.movement)
  })
}
