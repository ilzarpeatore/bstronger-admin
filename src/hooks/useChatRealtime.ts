import { useEffect, useRef, useState } from 'react'
import { chatRealtime, type ChatSocketEvent, type RealtimeConfig } from '@/lib/chatRealtime'

/**
 * Config de realtime del backend (`null` mientras carga). Con
 * `enabled: false` las vistas siguen con polling como en la fase 1.
 */
export function useChatRealtimeConfig(): RealtimeConfig | null {
  const [config, setConfig] = useState<RealtimeConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    chatRealtime.config().then((c) => {
      if (!cancelled) setConfig(c)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return config
}

/**
 * Escucha un canal del chat mientras el componente está montado.
 *
 * - `live`: true solo si el socket está conectado Y la suscripción a este
 *   canal está confirmada. Mientras sea false, la vista debe hacer polling.
 * - `onResync`: se llama cada vez que el canal pasa a estar en vivo (al
 *   conectar y tras cada reconexión), para recuperar con ?after=<id> lo que
 *   haya entrado mientras el socket estaba caído.
 */
export function useChatChannel(
  channel: string | null,
  onEvent: (e: ChatSocketEvent) => void,
  onResync?: () => void
): { live: boolean } {
  const [live, setLive] = useState(false)
  const onEventRef = useRef(onEvent)
  const onResyncRef = useRef(onResync)

  useEffect(() => {
    onEventRef.current = onEvent
    onResyncRef.current = onResync
  })

  useEffect(() => {
    if (!channel) {
      setLive(false)
      return
    }

    let wasLive = false
    const update = () => {
      const now = chatRealtime.isLive(channel)
      setLive(now)
      if (now && !wasLive) onResyncRef.current?.()
      wasLive = now
    }

    const unsubscribe = chatRealtime.subscribe(channel, (e) => onEventRef.current(e))
    const offState = chatRealtime.onStateChange(update)
    update()

    return () => {
      offState()
      unsubscribe()
    }
  }, [channel])

  return { live: Boolean(channel) && live }
}
