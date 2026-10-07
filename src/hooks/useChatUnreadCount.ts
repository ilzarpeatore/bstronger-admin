import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useChatChannel, useChatRealtimeConfig } from '@/hooks/useChatRealtime'

/**
 * Mensajes de clientes sin leer que le corresponden al admin/coach conectado.
 *
 * Es la señal real que tiene un entrenador de que hay algo nuevo: trabajan en
 * el navegador, no en la app, así que no tienen `expo_push_token` y el push de
 * Expo no les llega (ver §5 de docs/PLAN_CHAT_BACKEND.md en el repo bsa).
 *
 * Fase 2: si hay realtime, el badge se refresca al llegar un evento a la
 * bandeja de este usuario (chat.inbox.{id} o chat.admin-inbox) y el poll baja
 * a uno de seguridad cada 5 min. Sin socket, poll de 60 s como en la fase 1.
 * El número siempre sale de GET admin/chat/unread-count: el evento solo dice
 * "algo ha cambiado", el backend sigue siendo quien decide qué cuenta.
 */
export const POLL_MS = 60000
export const LIVE_POLL_MS = 300000
const EVENT_DEBOUNCE_MS = 400

export function useChatUnreadCount(): number {
  const [count, setCount] = useState(0)
  const config = useChatRealtimeConfig()
  const debounceRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/chat/unread-count')
      if (mountedRef.current) setCount(Number(res.data?.unread_count) || 0)
    } catch {
      // Silencioso a propósito: que falle el badge no puede llenar de toasts
      // una pantalla que ni siquiera es la del chat.
    }
  }, [])

  const inboxChannel = config?.enabled ? config.channels?.[0] ?? null : null
  const { live } = useChatChannel(
    inboxChannel,
    () => {
      // Varios eventos seguidos (mensaje + lectura) = una sola consulta.
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(load, EVENT_DEBOUNCE_MS)
    },
    load
  )

  useEffect(() => {
    mountedRef.current = true
    load()
    const id = window.setInterval(load, live ? LIVE_POLL_MS : POLL_MS)

    return () => {
      window.clearInterval(id)
    }
  }, [load, live])

  useEffect(
    () => () => {
      mountedRef.current = false
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    },
    []
  )

  return count
}
