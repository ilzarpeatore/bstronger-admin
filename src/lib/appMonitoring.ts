// Sección «Errores y uso de la app»: tipos de las respuestas de
// /admin/app-monitoring/* (proxy del backend a Sentry y PostHog) y helpers puros.

export type SentryIssue = {
  id: string
  short_id: string | null
  title: string
  culprit: string | null
  level: string | null
  count: number
  user_count: number
  first_seen: string | null
  last_seen: string | null
  permalink: string | null
}

export type ScreenRow = { screen: string; views: number; users: number }

export type MonitoringResponse<T> = {
  configured: boolean
  data: T[]
  total_views?: number
  message?: string
}

/** «hace 5 min», «hace 3 h», «hace 2 d» respecto a `now`. */
export function timeAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—'
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

/** Porcentaje de `value` sobre `total` con un decimal (0 si no hay total). */
export function share(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 1000) / 10
}
