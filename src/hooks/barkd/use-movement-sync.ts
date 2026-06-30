import { useQueryClient } from '@tanstack/react-query'
import { invalidateMovementState } from '@/lib/query-invalidations'
import { useNotifications } from './use-notifications'

export function useMovementSync(): void {
  const queryClient = useQueryClient()

  useNotifications((notification) => {
    if (
      notification.type === 'movement-created' ||
      notification.type === 'movement-updated' ||
      notification.type === 'channel-lagging'
    ) {
      void invalidateMovementState(queryClient)
    }
  })
}
