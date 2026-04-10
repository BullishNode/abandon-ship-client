import { useSyncExternalStore } from 'react'

let granted: boolean | null = null
let initialized = false
const subscribers = new Set<() => void>()

function notifyAll(): void {
  for (const cb of subscribers) {
    cb()
  }
}

function subscribe(callback: () => void): () => void {
  if (!initialized) {
    initialized = true
    navigator.permissions
      .query({ name: 'camera' as PermissionName })
      .then((status) => {
        granted = status.state === 'granted'
        status.addEventListener('change', () => {
          granted = status.state === 'granted'
          notifyAll()
        })
        notifyAll()
      })
      .catch(() => {
        granted = true
        notifyAll()
      })
  }
  subscribers.add(callback)
  return () => {
    subscribers.delete(callback)
  }
}

function getSnapshot(): boolean {
  return granted ?? false
}

export function useCameraReady(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
