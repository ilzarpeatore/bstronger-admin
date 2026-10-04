import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/**
 * Mensajes de clientes sin leer que le corresponden al admin/coach conectado.
 *
 * Es la señal real que tiene un entrenador de que hay algo nuevo: trabajan en
 * el navegador, no en la app, así que no tienen `expo_push_token` y el push de
 * Expo no les llega (ver §5 de docs/PLAN_CHAT_BACKEND.md en el repo bsa).
 *
 * Un minuto entre consultas es de sobra para un badge: el hilo abierto ya se
 * refresca cada 8 s por su cuenta en ChatInboxView, y esto solo decide si el
 * sidebar lleva un número.
 */
const POLL_MS = 60000

export function useChatUnreadCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await api.get('/admin/chat/unread-count')
        if (!cancelled) setCount(Number(res.data?.unread_count) || 0)
      } catch {
        // Silencioso a propósito: que falle el badge no puede llenar de toasts
        // una pantalla que ni siquiera es la del chat.
      }
    }

    load()
    const id = window.setInterval(load, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return count
}
