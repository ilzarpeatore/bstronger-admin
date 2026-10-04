import { useState, useEffect, useCallback, useRef } from 'react'
import { Send, RefreshCw, Search, Archive, ArchiveRestore, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// Bandeja del chat cliente <-> entrenador (docs/PLAN_CHAT_BACKEND.md en el repo bsa).
// Un coach solo ve los hilos de SUS clientes: el filtro NO se hace aqui, lo
// aplica el backend (ConversationPolicy + scope visibleTo). Esta vista no manda
// ningun coach_id ni filtra nada por su cuenta, a proposito.
//
// Fase 1 sin realtime: el hilo abierto se refresca con ?after=<id> cada
// POLL_MS. Cuando entre Reverb, lo unico que cambia es de donde llegan los
// mensajes nuevos; el resto de la vista sigue igual.

const POLL_MS = 8000

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
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingList, setLoadingList] = useState(false)

  const [active, setActive] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  // En un ref y no en el estado: el poll lo lee sin tener que re-crearse en
  // cada mensaje nuevo (si no, el intervalo se reiniciaria continuamente).
  const lastIdRef = useRef<number>(0)
  const activeIdRef = useRef<number | null>(null)

  const fetchConversations = useCallback(async () => {
    setLoadingList(true)
    try {
      const params = new URLSearchParams({ status, per_page: '50' })
      if (search.trim()) params.set('q', search.trim())
      const res = await api.get(`/admin/chat/conversations?${params.toString()}`)
      setConversations(res.data || [])
    } catch {
      toast.error('Error al cargar la bandeja de chat')
    } finally {
      setLoadingList(false)
    }
  }, [status, search])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const markRead = useCallback(async (conversationId: number, upToId: number) => {
    try {
      await api.post(`/admin/chat/conversations/${conversationId}/read`, { up_to_id: upToId })
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      )
    } catch {
      // Marcar leido no es critico: si falla, se reintenta al siguiente poll.
    }
  }, [])

  const openConversation = useCallback(
    async (conversation: Conversation) => {
      setActive(conversation)
      activeIdRef.current = conversation.id
      setLoadingThread(true)
      setMessages([])
      lastIdRef.current = 0
      try {
        const res = await api.get(`/admin/chat/conversations/${conversation.id}/messages?limit=50`)
        const list: Message[] = res.data?.messages || []
        setMessages(list)
        if (list.length) {
          lastIdRef.current = list[list.length - 1].id
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

  // Poll del hilo abierto. Solo pide el delta (?after=), asi que la respuesta
  // normal es una lista vacia.
  useEffect(() => {
    if (!active) return

    const id = window.setInterval(async () => {
      const conversationId = activeIdRef.current
      if (!conversationId) return
      try {
        const res = await api.get(
          `/admin/chat/conversations/${conversationId}/messages?after=${lastIdRef.current}`
        )
        const nuevos: Message[] = res.data?.messages || []
        if (nuevos.length) {
          setMessages((prev) => [...prev, ...nuevos])
          lastIdRef.current = nuevos[nuevos.length - 1].id
          markRead(conversationId, lastIdRef.current)
        }
      } catch {
        // Silencioso a proposito: un corte de red no debe llenar la pantalla
        // de toasts cada 8 segundos.
      }
    }, POLL_MS)

    return () => window.clearInterval(id)
  }, [active, markRead])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      const message: Message = res.data
      setMessages((prev) => [...prev, message])
      lastIdRef.current = message.id
      setDraft('')
      fetchConversations()
    } catch {
      toast.error('No se pudo enviar el mensaje')
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
      fetchConversations()
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
            <Button variant="outline" size="icon" onClick={fetchConversations} disabled={loadingList}>
              <RefreshCw className={cn('h-4 w-4', loadingList && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && !loadingList && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay conversaciones{search.trim() ? ' que coincidan con la búsqueda' : ''}.
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

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {loadingThread && (
                <p className="text-center text-sm text-muted-foreground">Cargando…</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn('flex', m.sender_role === 'client' ? 'justify-start' : 'justify-end')}
                >
                  <div
                    className={cn(
                      'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                      m.sender_role === 'client'
                        ? 'bg-muted'
                        : 'bg-primary text-primary-foreground'
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className="mt-1 text-right text-[10px] opacity-70">
                      {formatWhen(m.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 border-t p-4">
              <Input
                placeholder="Escribe un mensaje…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              <Button onClick={send} disabled={sending || !draft.trim()}>
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
