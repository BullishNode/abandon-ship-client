import { useSyncExternalStore } from 'react'

let granted: boolean | null = null
let initialized = false
const subscribers = new Set<() => void>()

function notifyAll(): void {
  for (const subscriber of subscribers) {
    subscriber()
  }
}

async function initPermissions(): Promise<void> {
  try {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
    granted = status.state === 'granted'
    status.addEventListener('change', () => {
      granted = status.state === 'granted'
      notifyAll()
    })
    notifyAll()
  } catch {
    granted = true
    notifyAll()
  }
}

function subscribe(listener: () => void): () => void {
  if (!initialized) {
    initialized = true
    void initPermissions()
  }
  subscribers.add(listener)
  return () => {
    subscribers.delete(listener)
  }
}

function getSnapshot(): boolean {
  return granted ?? false
}

export function useCameraReady(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
