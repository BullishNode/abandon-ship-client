import { backend } from '@/lib/backend'
import type { WalletNotification } from '@/types/domain/notification'

// Notification transport differs per backend (barkd WebSocket vs WASM worker
// poll loop); both fan a domain WalletNotification to the same listener set.
export function subscribeNotifications(
  listener: (notification: WalletNotification) => void
): () => void {
  return backend.notifications.subscribe(listener)
}
