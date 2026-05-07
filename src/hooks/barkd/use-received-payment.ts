import type { Movement } from '@secondts/barkd'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateWalletState } from '@/lib/query-invalidations'
import { useNotifications } from './use-notifications'

interface UseReceivedPaymentOptions {
  enabled?: boolean
}

export function useReceivedPayment(
  handler: (movement: Movement) => void,
  options?: UseReceivedPaymentOptions
): void {
  const queryClient = useQueryClient()

  useNotifications((notification) => {
    if (notification.type !== 'movement-created') {
      return
    }
    if (notification.movement.effectiveBalanceSat <= 0) {
      return
    }
    void invalidateWalletState(queryClient)
    handler(notification.movement)
  }, options)
}
