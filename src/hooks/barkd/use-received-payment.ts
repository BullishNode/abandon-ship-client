import type { Movement } from '@secondts/barkd'
import { useNotifications } from './use-notifications'

interface UseReceivedPaymentOptions {
  enabled?: boolean
}

export function useReceivedPayment(
  handler: (movement: Movement) => void,
  options?: UseReceivedPaymentOptions
): void {
  useNotifications((notification) => {
    if (notification.type !== 'movement-created') {
      return
    }
    if (notification.movement.effectiveBalanceSat <= 0) {
      return
    }
    handler(notification.movement)
  }, options)
}
