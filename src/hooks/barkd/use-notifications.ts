import type { WalletNotification } from '@secondts/barkd'
import { useEffect, useRef } from 'react'
import { subscribeNotifications } from '@/lib/notifications-bus'

interface UseNotificationsOptions {
  enabled?: boolean
}

export function useNotifications(
  handler: (notification: WalletNotification) => void,
  options?: UseNotificationsOptions
): void {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled) {
      return () => {
        // no cleanup when disabled
      }
    }
    return subscribeNotifications((notification) => {
      handlerRef.current(notification)
    })
  }, [enabled])
}
