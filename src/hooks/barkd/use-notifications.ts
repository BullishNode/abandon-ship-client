import type { WalletNotification } from '@/types/domain/notification'
import { useEffect, useRef } from 'react'
import { subscribeNotifications } from '@/lib/notifications-bus'

interface UseNotificationsOptions {
  enabled?: boolean
  onCleanup?: () => void
}

export function useNotifications(
  handler: (notification: WalletNotification) => void,
  options?: UseNotificationsOptions
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  const cleanupRef = useRef(options?.onCleanup)
  cleanupRef.current = options?.onCleanup
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled) {
      return () => {
        // no cleanup when disabled
      }
    }
    const unsubscribe = subscribeNotifications((notification) => {
      handlerRef.current(notification)
    })
    return () => {
      unsubscribe()
      cleanupRef.current?.()
    }
  }, [enabled])
}
