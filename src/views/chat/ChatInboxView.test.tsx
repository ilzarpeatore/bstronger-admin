import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PusherLike, RealtimeConfig } from '@/lib/chatRealtime'

const getMock = vi.fn()
const postMock = vi.fn()
vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => getMock(...a),
    post: (...a: unknown[]) => postMock(...a),
    patch: vi.fn(),
  },
  apiFetch: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// Socket de mentira: el test decide si hay realtime y dispara los eventos.
let realtimeConfig: RealtimeConfig = { enabled: false }
type FakePusher = PusherLike & {
  fire: (channel: string, event: string, data?: unknown) => void
  setState: (s: string) => void
}
let pusher: FakePusher

function makePusher(): FakePusher {
  const conn: Record<string, ((a: { current?: string }) => void)[]> = {}
  const chans: Record<string, Record<string, ((d: unknown) => void)[]>> = {}
  const p: FakePusher = {
    connection: {
      state: 'connecting',
      bind: (e, cb) => {
        ;(conn[e] ||= []).push(cb)
      },
    },
    subscribe: (c) => {
      chans[c] ||= {}
      return { bind: (e, cb) => void (chans[c][e] ||= []).push(cb) }
    },
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
    fire: (c, e, d) => chans[c]?.[e]?.forEach((cb) => cb(d)),
    setState: (s) => {
      p.connection.state = s
      conn.state_change?.forEach((cb) => cb({ current: s }))
    },
  }
  return p
}

vi.mock('@/lib/chatRealtime', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/chatRealtime')>()
  return {
    ...orig,
    get chatRealtime() {
      return currentClient
    },
  }
})
let currentClient: InstanceType<typeof import('@/lib/chatRealtime').ChatRealtimeClient>

import { ChatRealtimeClient } from '@/lib/chatRealtime'
import ChatInboxView from './ChatInboxView'

const CONVERSATION = {
  id: 9,
  status: 'open',
  unread_count: 1,
  last_message_at: '2026-10-06T10:00:00+00:00',
  client: { id: 3, name: 'Cliente Uno', email: 'c@x.test' },
  coach: { id: 7, name: 'Coach' },
  last_message: { body: 'Hola', sender_role: 'client', created_at: '2026-10-06T10:00:00+00:00' },
}

const msg = (id: number, body: string, role: 'client' | 'coach' = 'client') => ({
  id,
  body,
  sender_id: role === 'client' ? 3 : 7,
  sender_role: role,
  client_token: null,
  read_at: null,
  created_at: '2026-10-06T10:00:00+00:00',
})

beforeEach(() => {
  // jsdom no implementa scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  getMock.mockReset()
  postMock.mockReset().mockResolvedValue({ data: {} })
  pusher = makePusher()
  currentClient = new ChatRealtimeClient(async () => realtimeConfig, () => pusher)
  getMock.mockImplementation(async (url: string) => {
    if (url.startsWith('/admin/chat/conversations?')) return { data: [CONVERSATION] }
    if (url.includes('/messages?limit=')) {
      return { data: { conversation: { ...CONVERSATION, client_last_read_id: null }, messages: [msg(1, 'Primer mensaje')], has_more: false } }
    }
    if (url.includes('/messages?after=')) {
      return { data: { conversation: { ...CONVERSATION, client_last_read_id: null }, messages: [msg(1, 'Primer mensaje'), msg(2, 'Sigo aqui')], has_more: false } }
    }
    return { data: {} }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

const afterCalls = () => getMock.mock.calls.filter(([u]) => String(u).includes('after=')).length

describe('ChatInboxView', () => {
  it('sin realtime: hace polling del hilo abierto y no duplica mensajes', async () => {
    realtimeConfig = { enabled: false }
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ChatInboxView />)

    await user.click(await screen.findByText('Cliente Uno'))
    await screen.findByText('Primer mensaje')
    expect(screen.getByTestId('chat-transport')).toHaveTextContent('Actualización automática')

    await act(async () => {
      vi.advanceTimersByTime(8000)
    })
    await screen.findByText('Sigo aqui')
    // El poll devolvió también el mensaje 1, que ya estaba: sale una vez.
    expect(screen.getAllByText('Primer mensaje')).toHaveLength(1)
    expect(afterCalls()).toBeGreaterThanOrEqual(1)
  })

  it('con realtime en vivo: los mensajes llegan por socket, sin el poll de 8 s, y se ve el leído', async () => {
    realtimeConfig = {
      enabled: true,
      key: 'k',
      host: 'ws.test',
      port: 443,
      scheme: 'https',
      channels: ['chat.inbox.7'],
    }
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ChatInboxView />)
    await user.click(await screen.findByText('Cliente Uno'))
    await screen.findByText('Primer mensaje')

    await act(async () => {
      pusher.setState('connected')
      pusher.fire('private-chat.inbox.7', 'pusher:subscription_succeeded')
    })
    await waitFor(() => expect(screen.getByTestId('chat-transport')).toHaveTextContent('En directo'))
    const callsAfterResync = afterCalls()

    await act(async () => {
      pusher.fire('private-chat.inbox.7', 'chat.message', {
        conversation_id: 9,
        message: msg(5, 'Mi respuesta', 'coach'),
        conversation: { id: 9, status: 'open', client_last_read_id: null },
      })
    })
    await screen.findByText('Mi respuesta')
    expect(screen.getByLabelText('Enviado')).toBeInTheDocument()

    await act(async () => {
      pusher.fire('private-chat.inbox.7', 'chat.conversation', {
        conversation_id: 9,
        conversation: { id: 9, status: 'open', client_last_read_id: 5 },
      })
    })
    await waitFor(() => expect(screen.getByLabelText('Leído')).toBeInTheDocument())

    // En vivo no hay poll del hilo cada 8 s.
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    expect(afterCalls()).toBe(callsAfterResync)
  })
})
