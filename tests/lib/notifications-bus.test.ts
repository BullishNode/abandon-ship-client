import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletNotification } from '@/types/domain/notification'
import type * as NotificationsBus from '../../src/lib/notifications-bus'

type MessageHandler = (event: MessageEvent) => void

interface FakeSocketRecord {
  messageHandler: MessageHandler | undefined
  closed: boolean
}

const sockets: FakeSocketRecord[] = []
const websocketTicket = vi.fn<() => Promise<string>>()

const { partysocketPath, barkdClientPath } = vi.hoisted(() => ({
  barkdClientPath: '@/lib/barkd-client',
  partysocketPath: 'partysocket/ws'
}))

vi.mock(partysocketPath, () => ({
  default: class {
    record: FakeSocketRecord = { closed: false, messageHandler: undefined }
    constructor() {
      sockets.push(this.record)
    }
    addEventListener(event: string, handler: MessageHandler): void {
      if (event === 'message') {
        this.record.messageHandler = handler
      }
    }
    close(): void {
      this.record.closed = true
    }
  }
}))

vi.mock(barkdClientPath, () => ({
  notificationsApi: {
    websocketTicket: async () => await websocketTicket()
  }
}))

async function loadModule(): Promise<typeof NotificationsBus> {
  return await import('../../src/lib/notifications-bus')
}

describe('notifications-bus', () => {
  beforeEach(() => {
    vi.resetModules()
    sockets.length = 0
    websocketTicket.mockReset()
    websocketTicket.mockResolvedValue('ticket-abc')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a single socket for multiple listeners', async () => {
    const { subscribeNotifications } = await loadModule()
    const unsubA = subscribeNotifications(() => {})
    const unsubB = subscribeNotifications(() => {})
    expect(sockets).toHaveLength(1)
    unsubA()
    unsubB()
  })

  it('closes the socket when the last listener unsubscribes', async () => {
    const { subscribeNotifications } = await loadModule()
    const unsubA = subscribeNotifications(() => {})
    const unsubB = subscribeNotifications(() => {})
    unsubA()
    expect(sockets[0].closed).toBeFalsy()
    unsubB()
    expect(sockets[0].closed).toBeTruthy()
  })

  it('recreates a socket after all listeners leave and a new one joins', async () => {
    const { subscribeNotifications } = await loadModule()
    subscribeNotifications(() => {})()
    expect(sockets[0].closed).toBeTruthy()
    subscribeNotifications(() => {})
    expect(sockets).toHaveLength(2)
  })

  it('delivers parsed notifications to all listeners', async () => {
    const { subscribeNotifications } = await loadModule()
    const a = vi.fn<(n: WalletNotification) => void>()
    const b = vi.fn<(n: WalletNotification) => void>()
    subscribeNotifications(a)
    subscribeNotifications(b)
    sockets[0].messageHandler?.(
      new MessageEvent('message', { data: JSON.stringify({ type: 'channel-lagging' }) })
    )
    expect(a).toHaveBeenCalledExactlyOnceWith({ type: 'channel-lagging' })
    expect(b).toHaveBeenCalledExactlyOnceWith({ type: 'channel-lagging' })
  })

  it('ignores notification types this client does not know', async () => {
    const { subscribeNotifications } = await loadModule()
    const listener = vi.fn<(n: WalletNotification) => void>()
    subscribeNotifications(listener)
    sockets[0].messageHandler?.(
      new MessageEvent('message', { data: JSON.stringify({ type: 'unknown' }) })
    )
    expect(listener).not.toHaveBeenCalled()
  })

  it('ignores non-string message data', async () => {
    const { subscribeNotifications } = await loadModule()
    const listener = vi.fn<(n: WalletNotification) => void>()
    subscribeNotifications(listener)
    sockets[0].messageHandler?.(new MessageEvent('message', { data: 123 }))
    expect(listener).not.toHaveBeenCalled()
  })

  it('ignores malformed JSON without throwing', async () => {
    const { subscribeNotifications } = await loadModule()
    const listener = vi.fn<(n: WalletNotification) => void>()
    subscribeNotifications(listener)
    sockets[0].messageHandler?.(new MessageEvent('message', { data: 'not-json' }))
    expect(listener).not.toHaveBeenCalled()
  })

  it('ignores null or non-object JSON payloads', async () => {
    const { subscribeNotifications } = await loadModule()
    const listener = vi.fn<(n: WalletNotification) => void>()
    subscribeNotifications(listener)
    sockets[0].messageHandler?.(new MessageEvent('message', { data: 'null' }))
    sockets[0].messageHandler?.(new MessageEvent('message', { data: '"string"' }))
    sockets[0].messageHandler?.(new MessageEvent('message', { data: '42' }))
    expect(listener).not.toHaveBeenCalled()
  })
})
