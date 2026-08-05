import { useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { invalidateMovementState } from '@/lib/query-invalidations'
import type { WalletNotification } from '@/types/domain/notification'
import { useNotifications } from './use-notifications'

const MOVEMENT_SYNC_DEBOUNCE_MS = 250

const MOVEMENT_SYNC_TYPES = new Set<WalletNotification['type']>([
  'channel-lagging',
  'movement-created',
  'movement-updated'
])

export function useMovementSync(): void {
  const queryClient = useQueryClient()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearPendingSync(): void {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useNotifications(
    (notification) => {
      if (!MOVEMENT_SYNC_TYPES.has(notification.type)) {
        return
      }
      // A settling round emits a burst; debounce so it costs one refetch.
      clearPendingSync()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void invalidateMovementState(queryClient)
      }, MOVEMENT_SYNC_DEBOUNCE_MS)
    },
    { onCleanup: clearPendingSync }
  )
}
