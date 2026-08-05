import { NotificationsApi, WalletNotificationFromJSON } from '@secondts/barkd'
import ReconnectingWebSocket from 'partysocket/ws'
import { clientConfig } from '@/lib/backend/barkd/client-config'
import { toWalletNotification } from '@/lib/backend/barkd/map'
import type { WalletNotification } from '@/types/domain/notification'

type Listener = (notification: WalletNotification) => void

const MIN_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30_000
const RECONNECT_GROW_FACTOR = 2

const notificationsApi = new NotificationsApi(clientConfig)
const listeners = new Set<Listener>()

let socket: ReconnectingWebSocket | null = null

async function urlProvider(): Promise<string> {
  const ticket = await notificationsApi.websocketTicket()
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/barkd-ws/api/v1/notifications/ws?ticket=${encodeURIComponent(ticket)}`
}

function handleMessage(event: MessageEvent): void {
  if (typeof event.data !== 'string') {
    return
  }
  try {
    const json: unknown = JSON.parse(event.data)
    if (json === null || typeof json !== 'object') {
      return
    }
    const notification = toWalletNotification(WalletNotificationFromJSON(json))
    if (notification === null) {
      return
    }
    for (const listener of listeners) {
      listener(notification)
    }
  } catch {
    // ignore malformed payload
  }
}

export function subscribeNotifications(listener: Listener): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    socket = new ReconnectingWebSocket(urlProvider, [], {
      maxReconnectionDelay: MAX_RECONNECT_DELAY_MS,
      minReconnectionDelay: MIN_RECONNECT_DELAY_MS,
      reconnectionDelayGrowFactor: RECONNECT_GROW_FACTOR
    })
    socket.addEventListener('message', handleMessage)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && socket !== null) {
      socket.close()
      socket = null
    }
  }
}
