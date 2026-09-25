import { AlertTriangle, TrendingDown, Gauge, CalendarClock, CalendarX2, MoonStar, UserX, ClipboardX } from 'lucide-react'

// Tipos y helpers compartidos del Panel de Excepciones del Coach
// (docs/Panel_Excepciones_Implementacion.md, docs/Plan_Cierre_Motor_UI.md).
// Fuente única de verdad para CoachExceptionsView.tsx (panel completo por
// coach), CoachExceptionsCard.tsx (dashboard general + resumen de cliente)
// y Notifications.tsx (campana) -- evita reinventar el tipado/formatters en
// cada superficie.

export type ExceptionCategory =
  | 'dolor'
  | 'estancamiento'
  | 'sugerencia_carga'
  | 'readiness_bajo'
  | 'semana_adaptativa_pendiente'
  // DEPRECADO 2026-08-12 (docs/Score_Riesgo_Abandono_Implementacion.md):
  // sustituido por 'riesgo_abandono'. Se conserva el literal solo para que
  // ítems históricos ya cerrados sigan tipando sin error.
  | 'inactividad'
  | 'riesgo_abandono'
  // El cliente finalizó una sesión sin registrar ninguna serie (2026-09-25).
  | 'sesion_sin_registro'
  // Patrón: 2+ sesiones finalizadas sin series en pocos días (sessions:audit-empty).
  | 'patron_sesiones_sin_registro'

export type ExceptionSeverity = 'alta' | 'media' | 'baja'
export type ExceptionStatusVal = 'pendiente' | 'resuelta' | 'descartada'

// source_detail para category=sugerencia_carga|estancamiento
// (NextSessionTarget). proposed_weight/proposed_reps pueden ser null si la
// propuesta es solo sustitución de ejercicio; proposed_exercise solo si hay
// sustitución propuesta.
export type SuggestionSourceDetail = {
  target_id: number
  exercise?: string | null
  proposed_weight: number | null
  proposed_reps: number | null
  proposed_exercise?: string | null
  status?: string
}

// source_detail para category=semana_adaptativa_pendiente (AdaptiveWeekPlan).
export type AdaptiveWeekSourceDetail = {
  plan_id: number
  original_week_start?: string | null
  sessions_available?: number | null
  priorizacion?: string | null
  sessions_total: number | null
  sessions_kept: number
  sessions_dropped: number
  status?: string
}

export type ExceptionItem = {
  id: number
  coach_id: number
  client_id: number
  category: ExceptionCategory
  severity: ExceptionSeverity
  status: ExceptionStatusVal
  title: string
  description: string | null
  created_at: string
  client?: { id: number; first_name?: string; last_name?: string; display_name?: string; email?: string }
  source_detail?: SuggestionSourceDetail | AdaptiveWeekSourceDetail | null
}

export type CoachOption = { id: number; name: string }

export const CATEGORY_META: Record<ExceptionCategory, { label: string; icon: typeof AlertTriangle }> = {
  dolor: { label: 'Dolor', icon: AlertTriangle },
  estancamiento: { label: 'Estancamiento', icon: TrendingDown },
  sugerencia_carga: { label: 'Sugerencia de carga', icon: Gauge },
  readiness_bajo: { label: 'Readiness bajo', icon: MoonStar },
  semana_adaptativa_pendiente: { label: 'Semana adaptativa', icon: CalendarClock },
  inactividad: { label: 'Inactividad', icon: CalendarX2 },
  riesgo_abandono: { label: 'Riesgo de abandono', icon: UserX },
  sesion_sin_registro: { label: 'Sesión sin registrar', icon: ClipboardX },
  patron_sesiones_sin_registro: { label: 'No registra series', icon: ClipboardX },
}

// Categorías con acción real de aprobar/editar/rechazar (Fase 1) en vez de
// solo resolver/descartar bookkeeping.
export function isSuggestionCategory(category: ExceptionCategory): boolean {
  return category === 'sugerencia_carga' || category === 'estancamiento'
}

export function isAdaptiveWeekCategory(category: ExceptionCategory): boolean {
  return category === 'semana_adaptativa_pendiente'
}

export function asSuggestionDetail(item: ExceptionItem): SuggestionSourceDetail | null {
  if (!isSuggestionCategory(item.category) || !item.source_detail) return null
  return item.source_detail as SuggestionSourceDetail
}

export function asAdaptiveWeekDetail(item: ExceptionItem): AdaptiveWeekSourceDetail | null {
  if (!isAdaptiveWeekCategory(item.category) || !item.source_detail) return null
  return item.source_detail as AdaptiveWeekSourceDetail
}

// Dolor siempre se destaca visualmente por encima de cualquier otra
// categoría, incluso si dos ítems comparten severidad "alta" -- es la
// única con implicación de seguridad real (documento §6, último bullet).
export function cardAccentClass(item: Pick<ExceptionItem, 'category' | 'severity'>): string {
  if (item.category === 'dolor') {
    return 'border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20'
  }
  if (item.severity === 'alta') {
    return 'border-red-200 bg-red-50/30 dark:border-red-950 dark:bg-red-950/10'
  }
  if (item.severity === 'media') {
    return 'border-amber-200 bg-amber-50/30 dark:border-amber-950 dark:bg-amber-950/10'
  }
  return 'border-border'
}

export function severityBadgeVariant(s: ExceptionSeverity): 'destructive' | 'default' | 'secondary' {
  if (s === 'alta') return 'destructive'
  if (s === 'media') return 'default'
  return 'secondary'
}

export function clientLabel(item: Pick<ExceptionItem, 'client' | 'client_id'>): string {
  const c = item.client
  if (!c) return `Cliente #${item.client_id}`
  return c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || `Cliente #${item.client_id}`
}

export function formatRelative(dateStr: string): string {
  const d = new Date(dateStr)
  const diffMs = Date.now() - d.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) return 'hace menos de 1h'
  if (diffH < 24) return `hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `hace ${diffD}d`
}

// Orden dolor > alta > media > baja, mismo criterio que cardAccentClass
// aplicado a nivel de lista completa (dashboard/resumen de cliente, donde
// no hay agrupación previa por severidad como en CoachExceptionsView).
export function severityRank(item: Pick<ExceptionItem, 'category' | 'severity'>): number {
  if (item.category === 'dolor') return 0
  if (item.severity === 'alta') return 1
  if (item.severity === 'media') return 2
  return 3
}

export function sortByUrgency(items: ExceptionItem[]): ExceptionItem[] {
  return [...items].sort((a, b) => severityRank(a) - severityRank(b) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
}
