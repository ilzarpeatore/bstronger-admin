import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Send,
  RefreshCw,
  Search,
  Archive,
  ArchiveRestore,
  MessageSquare,
  Check,
  CheckCheck,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { mergeMessages, type ChatSocketEvent } from '@/lib/chatRealtime'
import { useChatChannel, useChatRealtimeConfig } from '@/hooks/useChatRealtime'

// Bandeja del chat cliente <-> entrenador (docs/PLAN_CHAT_BACKEND.md en el repo bsa).
// Un coach solo ve los hilos de SUS clientes: el filtro NO se hace aqui, lo
// aplica el backend (ConversationPolicy + scope visibleTo). Esta vista no manda
// ningun coach_id ni filtra nada por su cuenta, a proposito.
//
// Transporte (fase 2): si el backend tiene Reverb, la vista escucha el canal
// de bandeja de este usuario (chat.inbox.{id} o chat.admin-inbox, lo decide el
// backend) y deja de hacer polling salvo uno de seguridad. Si no hay realtime
// o el socket cae, vuelve sola al polling de la fase 1 (?after=<id>). Los
// mensajes se unen por id, asi que da igual por que via lleguen (o si llegan
// por las dos).

const POLL_MS = 8000
const LIVE_SAFETY_POLL_MS = 60000
const LIST_POLL_MS = 30000
const SEARCH_DEBOUNCE_MS = 300
const LIST_REFRESH_DEBOUNCE_MS = 500
const PAGE_SIZE = 50

type ChatClient = { id: number; name: string; email: string }
type ChatCoach = { id: number; name: string }

type LastMessage = {
  body: string
  sender_role: 'client' | 'coach' | 'admin'
  created_at: string | null
}

type Conversation = {
  id: number
  status: 'open' | 'closed'
  unread_count: number
  last_message_at: string | null
  client: ChatClient | null
  coach: ChatCoach | null
  last_message: LastMessage | null
  client_last_read_id?: number | null
}

type Message = {
  id: number
  body: string
  sender_id: number
  sender_role: 'client' | 'coach' | 'admin'
  client_token: string | null
  read_at: string | null
  created_at: string | null
}

const STATUS_TABS: { value: 'open' | 'closed'; label: string }[] = [
  { value: 'open', label: 'Abiertas' },
  { value: 'closed', label: 'Cerradas' },
]

function formatWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()

  return sameDay
    ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
}

const ChatInboxView = () => {
  const [status, setStatus] = useState<'open' | 'closed'>('open')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingList, setLoadingList] = useState(false)

  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [clientLastReadId, setClientLastReadId] = useState<number | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  // En refs y no en el estado: el poll y los eventos los leen sin tener que
  // re-crearse en cada mensaje nuevo.
  const lastIdRef = useRef<number>(0)
  const activeIdRef = useRef<number | null>(null)
  const listTimerRef = useRef<number | null>(null)
  const stickToBottomRef = useRef(true)

  const realtime = useChatRealtimeConfig()
  const inboxChannel = realtime?.enabled ? realtime.channels?.[0] ?? null : null

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [search])

  const fetchConversations = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingList(true)
      try {
        const params = new URLSearchParams({ status, per_page: '50' })
        if (debouncedSearch) params.set('q', debouncedSearch)
        const res = await api.get(`/admin/chat/conversations?${params.toString()}`)
        setConversations(res.data || [])
      } catch {
        if (!silent) toast.error('Error al cargar la bandeja de chat')
      } finally {
        if (!silent) setLoadingList(false)
      }
    },
    [status, debouncedSearch]
  )

  const refreshListSoon = useCallback(() => {
    if (listTimerRef.current) window.clearTimeout(listTimerRef.current)
    listTimerRef.current = window.setTimeout(() => fetchConversations(true), LIST_REFRESH_DEBOUNCE_MS)
  }, [fetchConversations])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(
    () => () => {
      if (listTimerRef.current) window.clearTimeout(listTimerRef.current)
    },
    []
  )

  const markRead = useCallback(async (conversationId: number, upToId: number) => {
    try {
      await api.post(`/admin/chat/conversations/${conversationId}/read`, { up_to_id: upToId })
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      )
    } catch {
      // Marcar leido no es critico: si falla, se reintenta con el siguiente mensaje.
    }
  }, [])

  const appendMessages = useCallback(
    (conversationId: number, incoming: Message[]) => {
      if (conversationId !== activeIdRef.current || incoming.length === 0) return
      stickToBottomRef.current = true
      setMessages((prev) => mergeMessages(prev, incoming))
      const newest = incoming.reduce((max, m) => Math.max(max, m.id), lastIdRef.current)
      lastIdRef.current = newest
      if (incoming.some((m) => m.sender_role === 'client')) markRead(conversationId, newest)
    },
    [markRead]
  )

  /** Delta del hilo abierto (?after=). Es el poll y tambien el resync tras reconectar. */
  const fetchDelta = useCallback(async () => {
    const conversationId = activeIdRef.current
    if (!conversationId) return
    try {
      const res = await api.get(
        `/admin/chat/conversations/${conversationId}/messages?after=${lastIdRef.current}&limit=100`
      )
      if (conversationId !== activeIdRef.current) return
      appendMessages(conversationId, res.data?.messages || [])
      const pointer = res.data?.conversation?.client_last_read_id
      if (pointer !== undefined) setClientLastReadId(pointer ?? null)
    } catch {
      // Silencioso a proposito: un corte de red no debe llenar la pantalla
      // de toasts en cada poll.
    }
  }, [appendMessages])

  const onSocketEvent = useCallback(
    (e: ChatSocketEvent) => {
      const conversationId = Number(e.data?.conversation_id)
      if (e.event === 'chat.message' && e.data?.message) {
        appendMessages(conversationId, [e.data.message as Message])
      }
      if (conversationId === activeIdRef.current && e.data?.conversation) {
        const state = e.data.conversation
        if (state.client_last_read_id !== undefined) setClientLastReadId(state.client_last_read_id ?? null)
        if (state.status) setActive((prev) => (prev ? { ...prev, status: state.status } : prev))
      }
      refreshListSoon()
    },
    [appendMessages, refreshListSoon]
  )

  const { live } = useChatChannel(inboxChannel, onSocketEvent, () => {
    // Al (re)conectar: recuperar lo que entro mientras no habia socket.
    fetchDelta()
    refreshListSoon()
  })

  const openConversation = useCallback(
    async (conversation: Conversation) => {
      setActive(conversation)
      activeIdRef.current = conversation.id
      setLoadingThread(true)
      setMessages([])
      setHasMore(false)
      setClientLastReadId(null)
      lastIdRef.current = 0
      stickToBottomRef.current = true
      try {
        const res = await api.get(`/admin/chat/conversations/${conversation.id}/messages?limit=${PAGE_SIZE}`)
        if (activeIdRef.current !== conversation.id) return
        const list: Message[] = res.data?.messages || []
        setMessages((prev) => mergeMessages(prev, list))
        setHasMore(Boolean(res.data?.has_more))
        setClientLastReadId(res.data?.conversation?.client_last_read_id ?? null)
        if (list.length) {
          lastIdRef.current = Math.max(lastIdRef.current, list[list.length - 1].id)
          markRead(conversation.id, lastIdRef.current)
        }
      } catch {
        toast.error('Error al abrir la conversación')
      } finally {
        setLoadingThread(false)
      }
    },
    [markRead]
  )

  const loadOlder = async () => {
    const conversationId = activeIdRef.current
    if (!conversationId || loadingOlder || messages.length === 0) return
    setLoadingOlder(true)
    stickToBottomRef.current = false
    const container = scrollRef.current
    const prevHeight = container?.scrollHeight ?? 0
    try {
      const res = await api.get(
        `/admin/chat/conversations/${conversationId}/messages?limit=${PAGE_SIZE}&before=${messages[0].id}`
      )
      if (conversationId !== activeIdRef.current) return
      setMessages((prev) => mergeMessages(prev, res.data?.messages || []))
      setHasMore(Boolean(res.data?.has_more))
      // Mantener la vista donde estaba en vez de saltar arriba del todo.
      requestAnimationFrame(() => {
        if (container) container.scrollTop += container.scrollHeight - prevHeight
      })
    } catch {
      toast.error('No se pudieron cargar los mensajes anteriores')
    } finally {
      setLoadingOlder(false)
    }
  }

  // Poll del hilo abierto: el de la fase 1 sin socket, uno de seguridad con él.
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(fetchDelta, live ? LIVE_SAFETY_POLL_MS : POLL_MS)
    return () => window.clearInterval(id)
  }, [active, live, fetchDelta])

  // Poll de la bandeja solo sin socket (con él, la refrescan los eventos).
  useEffect(() => {
    if (live) return
    const id = window.setInterval(() => fetchConversations(true), LIST_POLL_MS)
    return () => window.clearInterval(id)
  }, [live, fetchConversations])

  useEffect(() => {
    if (stickToBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const body = draft.trim()
    if (!body || !active || sending) return

    setSending(true)
    try {
      const res = await api.post(`/admin/chat/conversations/${active.id}/messages`, {
        body,
        // Idempotencia: si el POST se reintenta, el backend devuelve el mismo
        // mensaje en vez de duplicarlo.
        client_token: crypto.randomUUID(),
      })
      appendMessages(active.id, [res.data as Message])
      setDraft('')
      refreshListSoon()
    } catch (err) {
      const statusCode = (err as { status?: number })?.status
      toast.error(
        statusCode === 429
          ? 'Demasiados mensajes seguidos. Espera un momento.'
          : 'No se pudo enviar el mensaje'
      )
    } finally {
      setSending(false)
    }
  }

  const toggleStatus = async () => {
    if (!active) return
    const next = active.status === 'open' ? 'closed' : 'open'
    try {
      const res = await api.patch(`/admin/chat/conversations/${active.id}`, { status: next })
      setActive(res.data)
      toast.success(next === 'closed' ? 'Conversación cerrada' : 'Conversación reabierta')
      fetchConversations(true)
    } catch {
      toast.error('No se pudo cambiar el estado')
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      {/* Bandeja */}
      <Card className="flex h-[calc(100vh-200px)] flex-col overflow-hidden">
        <div className="space-y-3 border-b p-4">
          <Tabs value={status} onValueChange={(v) => setStatus(v as 'open' | 'closed')}>
            <TabsList className="w-full">
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="flex-1">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchConversations()}
              disabled={loadingList}
              aria-label="Recargar bandeja"
            >
              <RefreshCw className={cn('h-4 w-4', loadingList && 'animate-spin')} />
            </Button>
          </div>
          <p
            className="flex items-center gap-1 text-xs text-muted-foreground"
            data-testid="chat-transport"
          >
            <Radio className={cn('h-3 w-3', live && 'text-green-600')} />
            {live ? 'En directo' : 'Actualización automática cada pocos segundos'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && !loadingList && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay conversaciones{debouncedSearch ? ' que coincidan con la búsqueda' : ''}.
            </p>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c)}
              className={cn(
                'w-full border-b p-3 text-left transition-colors hover:bg-muted/50',
                active?.id === c.id && 'bg-muted'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-medium">{c.client?.name || 'Cliente'}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatWhen(c.last_message_at)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm text-muted-foreground">
                  {c.last_message
                    ? `${c.last_message.sender_role === 'client' ? '' : 'Tú: '}${c.last_message.body}`
                    : 'Sin mensajes'}
                </span>
                {c.unread_count > 0 && <Badge className="shrink-0">{c.unread_count}</Badge>}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Hilo */}
      <Card className="flex h-[calc(100vh-200px)] flex-col overflow-hidden">
        {!active ? (
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-10 w-10" />
            <p className="text-sm">Elige una conversación de la bandeja.</p>
          </CardContent>
        ) : (
          <>
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <p className="font-medium">{active.client?.name || 'Cliente'}</p>
                <p className="text-xs text-muted-foreground">
                  {active.client?.email}
                  {active.coach ? ` · entrenador: ${active.coach.name}` : ' · sin entrenador'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={toggleStatus}>
                {active.status === 'open' ? (
                  <>
                    <Archive className="mr-2 h-4 w-4" /> Cerrar
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="mr-2 h-4 w-4" /> Reabrir
                  </>
                )}
              </Button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {loadingThread && (
                <p className="text-center text-sm text-muted-foreground">Cargando…</p>
              )}
              {hasMore && !loadingThread && (
                <div className="flex justify-center">
                  <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder}>
                    {loadingOlder ? 'Cargando…' : 'Ver mensajes anteriores'}
                  </Button>
                </div>
              )}
              {messages.map((m) => {
                const mine = m.sender_role !== 'client'
                const read = mine && clientLastReadId !== null && m.id <= clientLastReadId
                return (
                  <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                        mine ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                        {formatWhen(m.created_at)}
                        {mine &&
                          (read ? (
                            <CheckCheck className="h-3 w-3" aria-label="Leído" />
                          ) : (
                            <Check className="h-3 w-3" aria-label="Enviado" />
                          ))}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 border-t p-4">
              <Input
                placeholder="Escribe un mensaje…"
                value={draft}
                maxLength={5000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              <Button onClick={send} disabled={sending || !draft.trim()} aria-label="Enviar">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export default ChatInboxView
