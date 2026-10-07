import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() }, apiFetch: vi.fn() }))

import {
  ChatRealtimeClient,
  conversationChannel,
  mergeMessages,
  type PusherLike,
  type RealtimeConfig,
} from './chatRealtime'

const ENABLED: RealtimeConfig = {
  enabled: true,
  key: 'k',
  host: 'ws.example.test',
  port: 443,
  scheme: 'https',
  auth_endpoint: 'broadcasting/auth',
  channels: ['chat.inbox.7'],
}

/** pusher-js de mentira: deja disparar a mano estados y eventos. */
function fakePusher() {
  const connectionHandlers: Record<string, ((a: { current?: string }) => void)[]> = {}
  const channelHandlers: Record<string, Record<string, ((d: unknown) => void)[]>> = {}
  const pusher: PusherLike & {
    setState: (s: string) => void
    fire: (channel: string, event: string, data?: unknown) => void
    subscribeCalls: string[]
    unsubscribed: string[]
  } = {
    subscribeCalls: [],
    unsubscribed: [],
    connection: {
      state: 'connecting',
      bind: (event, cb) => {
        ;(connectionHandlers[event] ||= []).push(cb)
      },
    },
    subscribe: (channel) => {
      pusher.subscribeCalls.push(channel)
      channelHandlers[channel] ||= {}
      return {
        bind: (event, cb) => {
          ;(channelHandlers[channel][event] ||= []).push(cb)
        },
      }
    },
    unsubscribe: (channel) => {
      pusher.unsubscribed.push(channel)
    },
    disconnect: vi.fn(),
    setState: (s) => {
      pusher.connection.state = s
      connectionHandlers.state_change?.forEach((cb) => cb({ current: s }))
    },
    fire: (channel, event, data) => {
      channelHandlers[channel]?.[event]?.forEach((cb) => cb(data))
    },
  }
  return pusher
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('mergeMessages', () => {
  it('une sin duplicar por id y en orden', () => {
    const prev = [{ id: 1 }, { id: 3 }]
    expect(mergeMessages(prev, [{ id: 3 }, { id: 2 }, { id: 4 }]).map((m) => m.id)).toEqual([1, 2, 3, 4])
  })

  it('sin nada nuevo devuelve la misma lista (no re-renderiza)', () => {
    const prev = [{ id: 1 }]
    expect(mergeMessages(prev, [])).toBe(prev)
  })
})

describe('conversationChannel', () => {
  it('usa el prefijo del backend', () => {
    expect(conversationChannel({ enabled: true, conversation_channel_prefix: 'chat.conversation.' }, 5)).toBe(
      'chat.conversation.5'
    )
  })
})

describe('ChatRealtimeClient', () => {
  it('sin realtime en el backend ni intenta conectar: todo sigue en polling', async () => {
    const factory = vi.fn()
    const client = new ChatRealtimeClient(async () => ({ enabled: false }), factory)
    const listener = vi.fn()

    client.subscribe('chat.inbox.7', listener)
    await flush()

    expect(factory).not.toHaveBeenCalled()
    expect(client.isLive('chat.inbox.7')).toBe(false)
  })

  it('si falla la consulta de config, se trata como sin realtime', async () => {
    const factory = vi.fn()
    const client = new ChatRealtimeClient(async () => {
      throw new Error('500')
    }, factory)

    await expect(client.config()).resolves.toEqual({ enabled: false })
    client.subscribe('chat.inbox.7', vi.fn())
    await flush()
    expect(factory).not.toHaveBeenCalled()
  })

  it('en vivo solo con socket conectado Y suscripción confirmada; reparte los eventos', async () => {
    const pusher = fakePusher()
    const client = new ChatRealtimeClient(async () => ENABLED, () => pusher)
    const listener = vi.fn()
    const states: boolean[] = []
    client.onStateChange((c) => states.push(c))

    client.subscribe('chat.inbox.7', listener)
    await flush()
    expect(pusher.subscribeCalls).toEqual(['private-chat.inbox.7'])
    expect(client.isLive('chat.inbox.7')).toBe(false)

    pusher.setState('connected')
    expect(client.isLive('chat.inbox.7')).toBe(false)
    pusher.fire('private-chat.inbox.7', 'pusher:subscription_succeeded')
    expect(client.isLive('chat.inbox.7')).toBe(true)

    pusher.fire('private-chat.inbox.7', 'chat.message', { conversation_id: 3 })
    expect(listener).toHaveBeenCalledWith({
      event: 'chat.message',
      channel: 'chat.inbox.7',
      data: { conversation_id: 3 },
    })

    // Se cae el socket: vuelta a polling hasta que se re-confirme.
    pusher.setState('unavailable')
    expect(client.isLive('chat.inbox.7')).toBe(false)
    pusher.setState('connected')
    expect(client.isLive('chat.inbox.7')).toBe(false)
    pusher.fire('private-chat.inbox.7', 'pusher:subscription_succeeded')
    expect(client.isLive('chat.inbox.7')).toBe(true)
    expect(states).toContain(false)
  })

  it('una suscripción rechazada deja ese canal en polling', async () => {
    const pusher = fakePusher()
    const client = new ChatRealtimeClient(async () => ENABLED, () => pusher)
    client.subscribe('chat.admin-inbox', vi.fn())
    await flush()
    pusher.setState('connected')
    pusher.fire('private-chat.admin-inbox', 'pusher:subscription_error', { status: 403 })

    expect(client.isLive('chat.admin-inbox')).toBe(false)
  })

  it('dos oyentes del mismo canal: una suscripción, un evento cada uno, y se suelta con el último', async () => {
    const pusher = fakePusher()
    const client = new ChatRealtimeClient(async () => ENABLED, () => pusher)
    const a = vi.fn()
    const b = vi.fn()

    const offA = client.subscribe('chat.inbox.7', a)
    const offB = client.subscribe('chat.inbox.7', b)
    await flush()
    expect(pusher.subscribeCalls).toEqual(['private-chat.inbox.7'])

    pusher.fire('private-chat.inbox.7', 'chat.conversation', { conversation_id: 1 })
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    offA()
    expect(pusher.unsubscribed).toEqual([])
    offB()
    expect(pusher.unsubscribed).toEqual(['private-chat.inbox.7'])
  })
})
