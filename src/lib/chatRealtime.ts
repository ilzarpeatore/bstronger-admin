import Pusher from 'pusher-js'
import { api, apiFetch } from '@/lib/api'

/**
 * Realtime del chat (fase 2): WebSocket con Reverb, protocolo de Pusher.
 *
 * Regla de oro: el realtime es una mejora, nunca un requisito. El polling de
 * la fase 1 (?after=<id>) sigue siempre disponible y las vistas vuelven a él
 * cuando:
 *  - el backend dice `enabled: false` (Reverb sin configurar, o el
 *    interruptor CHAT_REALTIME=false): ni se intenta conectar;
 *  - el socket no está conectado o la suscripción al canal falla.
 *
 * Una sola conexión para todo el panel (badge del sidebar + bandeja), con
 * suscripciones por canal contadas por referencia.
 *
 * Contrato: /mnt/project-files/chat/contrato-api.md y
 * Bckbs docs/REVERB_DESPLIEGUE.md.
 */

export type RealtimeConfig = {
  enabled: boolean
  driver?: string
  key?: string
  host?: string
  port?: number
  scheme?: 'http' | 'https'
  auth_endpoint?: string
  channels?: string[]
  conversation_channel_prefix?: string
}

export type ChatEventName = 'chat.message' | 'chat.conversation'

export type ChatSocketEvent = {
  event: ChatEventName
  channel: string
  data: any
}

type Listener = (e: ChatSocketEvent) => void
type StateListener = (connected: boolean) => void

const EVENTS: ChatEventName[] = ['chat.message', 'chat.conversation']

/** Lo mínimo de pusher-js que se usa, para poder sustituirlo en tests. */
export type PusherLike = {
  connection: {
    state: string
    bind: (event: string, cb: (arg: { current?: string }) => void) => void
  }
  subscribe: (channel: string) => {
    bind: (event: string, cb: (data: unknown) => void) => void
  }
  unsubscribe: (channel: string) => void
  disconnect: () => void
}

export type PusherFactory = (config: RealtimeConfig) => PusherLike

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export const defaultPusherFactory: PusherFactory = (config) =>
  new Pusher(config.key as string, {
    cluster: 'mt1', // obligatorio en el tipo; con wsHost propio no se usa
    wsHost: config.host,
    wsPort: config.port,
    wssPort: config.port,
    forceTLS: config.scheme !== 'http',
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    channelAuthorization: {
      endpoint: `${API_URL}/${config.auth_endpoint || 'broadcasting/auth'}`,
      transport: 'ajax',
      // Mismo token Bearer que el resto del panel (lib/api.ts), no cookies.
      customHandler: ({ socketId, channelName }, callback) => {
        apiFetch(`/${config.auth_endpoint || 'broadcasting/auth'}`, {
          method: 'POST',
          body: { socket_id: socketId, channel_name: channelName },
        })
          .then((data) => callback(null, data))
          .catch((err) => callback(err instanceof Error ? err : new Error(String(err)), null))
      },
    },
  }) as unknown as PusherLike

export class ChatRealtimeClient {
  private configPromise: Promise<RealtimeConfig> | null = null
  private pusher: PusherLike | null = null
  private connected = false
  private stateListeners = new Set<StateListener>()
  private channelListeners = new Map<string, Set<Listener>>()
  private subscribed = new Set<string>()
  // Canales con los handlers ya enganchados: pusher-js devuelve el mismo
  // objeto si se suscribe dos veces, y engancharlos otra vez duplicaría
  // cada evento.
  private bound = new Set<string>()

  constructor(
    private loadConfig: () => Promise<RealtimeConfig>,
    private factory: PusherFactory = defaultPusherFactory
  ) {}

  /** Config del backend, una vez por sesión de panel. Nunca lanza. */
  config(): Promise<RealtimeConfig> {
    if (!this.configPromise) {
      this.configPromise = this.loadConfig().catch(() => ({ enabled: false }))
    }
    return this.configPromise
  }

  isConnected(): boolean {
    return this.connected
  }

  /** ¿Llegan por socket los eventos de este canal ahora mismo? */
  isLive(channel: string): boolean {
    return this.connected && this.subscribed.has(channel)
  }

  onStateChange(cb: StateListener): () => void {
    this.stateListeners.add(cb)
    return () => {
      this.stateListeners.delete(cb)
    }
  }

  /**
   * Escucha los eventos del chat de un canal. Devuelve la función para dejar
   * de escuchar. Si no hay realtime, no hace nada (y la vista sigue con poll).
   */
  subscribe(channel: string, listener: Listener): () => void {
    let listeners = this.channelListeners.get(channel)
    if (!listeners) {
      listeners = new Set()
      this.channelListeners.set(channel, listeners)
    }
    listeners.add(listener)
    void this.ensureChannel(channel)

    return () => {
      const set = this.channelListeners.get(channel)
      if (!set) return
      set.delete(listener)
      if (set.size === 0) {
        this.channelListeners.delete(channel)
        this.subscribed.delete(channel)
        if (this.bound.delete(channel)) this.pusher?.unsubscribe(`private-${channel}`)
      }
    }
  }

  disconnect(): void {
    this.pusher?.disconnect()
    this.pusher = null
    this.subscribed.clear()
    this.bound.clear()
    this.setConnected(false)
  }

  private async ensureChannel(channel: string): Promise<void> {
    const pusher = await this.ensurePusher()
    if (!pusher || !this.channelListeners.has(channel) || this.bound.has(channel)) return
    this.bound.add(channel)

    // Pusher exige el prefijo private- para los canales con autorización.
    const sub = pusher.subscribe(`private-${channel}`)
    sub.bind('pusher:subscription_succeeded', () => {
      this.subscribed.add(channel)
      this.emitState()
    })
    // Sin permiso (o el endpoint de auth falla): ese canal se queda en
    // polling. No es un error para el usuario.
    sub.bind('pusher:subscription_error', () => {
      this.subscribed.delete(channel)
      this.emitState()
    })
    for (const event of EVENTS) {
      sub.bind(event, (data) => {
        this.channelListeners.get(channel)?.forEach((l) => l({ event, channel, data }))
      })
    }
  }

  private async ensurePusher(): Promise<PusherLike | null> {
    if (this.pusher) return this.pusher
    const config = await this.config()
    if (!config.enabled || !config.key || !config.host) return null
    if (this.pusher) return this.pusher

    try {
      this.pusher = this.factory(config)
    } catch {
      return null
    }
    this.pusher.connection.bind('state_change', (states) => {
      this.setConnected(states.current === 'connected')
    })
    this.setConnected(this.pusher.connection.state === 'connected')
    return this.pusher
  }

  private setConnected(connected: boolean) {
    if (connected === this.connected) return
    this.connected = connected
    // Al caer, pusher-js vuelve a suscribir solo al reconectar; hasta que
    // confirme, se considera que no hay nada en vivo.
    if (!connected) this.subscribed.clear()
    this.emitState()
  }

  private emitState() {
    this.stateListeners.forEach((l) => l(this.connected))
  }
}

/** Instancia única del panel. */
export const chatRealtime = new ChatRealtimeClient(async () => {
  const res = await api.get('/admin/chat/realtime')
  return (res?.data as RealtimeConfig) || { enabled: false }
})

export function conversationChannel(config: RealtimeConfig, conversationId: number): string {
  return `${config.conversation_channel_prefix || 'chat.conversation.'}${conversationId}`
}

/**
 * Une mensajes nuevos (socket o poll) con los que ya hay: sin duplicados por
 * id, en orden. El mismo mensaje puede llegar por las dos vías, o por el POST
 * propio y luego por el socket.
 */
export function mergeMessages<T extends { id: number }>(prev: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return prev
  const byId = new Map<number, T>()
  for (const m of prev) byId.set(m.id, m)
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}
