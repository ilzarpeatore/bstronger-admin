// Retos (contrato: /mnt/project-files/retos/contrato-api.md). Tipos, validación del
// asistente y utilidades puras del panel; sin React, para poder testearlas.

export type ChallengeStatus = 'draft' | 'scheduled' | 'active' | 'finalizing' | 'closed' | 'cancelled'
export type ChallengeVisibility = 'open' | 'closed'
export type ChallengeFormat = 'threshold' | 'leaderboard'
export type ParticipantStatus = 'invited' | 'joined' | 'left' | 'declined' | 'excluded'

export type MetricParamType = 'number' | 'habit_template' | 'benchmark' | 'text'

export type MetricParam = {
  key: string
  label?: string
  type?: MetricParamType
  required?: boolean
  options?: { value: string; label: string }[]
}

export type ChallengeMetric = {
  key: string
  label: string
  unit?: string | null
  formats: ChallengeFormat[]
  params: MetricParam[]
  description?: string | null
  lower_is_better?: boolean
}

export type Challenge = {
  id: number
  title: string
  description: string | null
  cover_url: string | null
  prize: string | null
  visibility: ChallengeVisibility
  metric_key: string
  metric_label?: string | null
  unit?: string | null
  metric_params: Record<string, unknown> | null
  format: ChallengeFormat
  threshold_value: number | string | null
  start_date: string
  end_date: string
  join_deadline: string | null
  status: ChallengeStatus
  paid_only: boolean
  library_program_id: number | null
  min_participants: number | null
  max_participants: number | null
  participants_count?: number
  invited_count?: number
}

export type ChallengeParticipant = {
  client_id: number
  name?: string | null
  email?: string | null
  alias: string | null
  status: ParticipantStatus
  current_value: number | string | null
  rank: number | null
  progress_pct?: number | null
  threshold_reached?: boolean
  excluded_reason?: string | null
  joined_at?: string | null
}

export type ChallengeSnapshot = {
  client_id: number
  snapshot_date: string
  value: number | string
  rank?: number | null
}

export type ChallengeDetail = Challenge & {
  participants: ChallengeParticipant[]
  snapshots?: ChallengeSnapshot[]
}

// ── Pestañas ────────────────────────────────────────────────────────────────

export type ListTab = 'draft' | 'scheduled' | 'active' | 'finalizing' | 'closed'

export const LIST_TABS: { value: ListTab; label: string; statuses: ChallengeStatus[] }[] = [
  { value: 'draft', label: 'Borrador', statuses: ['draft'] },
  { value: 'scheduled', label: 'Programados', statuses: ['scheduled'] },
  { value: 'active', label: 'Activos', statuses: ['active'] },
  { value: 'finalizing', label: 'Por finalizar', statuses: ['finalizing'] },
  { value: 'closed', label: 'Cerrados', statuses: ['closed', 'cancelled'] },
]

export const STATUS_LABEL: Record<ChallengeStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programado',
  active: 'Activo',
  finalizing: 'Por finalizar',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
}

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  invited: 'Invitado',
  joined: 'Unido',
  left: 'Abandonó',
  declined: 'Rechazó',
  excluded: 'Excluido',
}

export function groupByTab(items: Challenge[]): Record<ListTab, Challenge[]> {
  const out = { draft: [], scheduled: [], active: [], finalizing: [], closed: [] } as Record<ListTab, Challenge[]>
  for (const c of items) {
    const tab = LIST_TABS.find(t => t.statuses.includes(c.status))
    if (tab) out[tab.value].push(c)
  }
  return out
}

/** Borrador, programado y activo se editan; en activo el backend no deja cambiar métrica, formato ni inicio. */
export const isEditable = (c: Pick<Challenge, 'status'>) => ['draft', 'scheduled', 'active'].includes(c.status)
/** Campos bloqueados una vez empezado el reto (cambiarlos sería injusto). */
export const isRulesLocked = (c: Pick<Challenge, 'status'> | null | undefined) => c?.status === 'active'
export const isCancellable = (c: Pick<Challenge, 'status'>) => ['draft', 'scheduled', 'active', 'finalizing'].includes(c.status)
export const isFinalizable = (c: Pick<Challenge, 'status'>) => c.status === 'finalizing' || c.status === 'active'
/** Se puede invitar mientras no haya terminado. */
export const canInvite = (c: Pick<Challenge, 'status' | 'visibility'>) =>
  c.visibility === 'closed' && ['draft', 'scheduled', 'active'].includes(c.status)

// ── Explicaciones de métricas (respaldo si el catálogo no trae descripción) ─

export const METRIC_HELP: Record<string, string> = {
  sessions: 'Sesiones válidas (con series apuntadas y fecha programada ≤ hoy). Justa si todos siguen el mismo programa; con programas de distinta frecuencia gana quien entrena más días.',
  adherence_pct: '% de sesiones programadas en el periodo que se completan con series. La más justa entre niveles: cada uno se mide contra su propio plan.',
  week_streak: 'Semanas consecutivas cumpliendo el plan. Justa entre niveles; mejor como reto de objetivo.',
  steps_total: 'Pasos totales del periodo, solo de Apple Salud / Google Health. Depende mucho del trabajo de cada uno: mejor como objetivo que como ranking.',
  steps_avg: 'Media de pasos diarios (solo dispositivo). Menos sensible a un día suelto que el total.',
  steps_goal_days: 'Días en los que se llega a la meta de pasos indicada (solo dispositivo). Más justa que el total: premia la constancia.',
  habit_days: 'Días con el hábito marcado. Es un botón y no se puede verificar: solo formato objetivo y sin premios grandes.',
  conditioning_km: 'Kilómetros de carrera registrados en bloques de acondicionamiento. Favorece a quien ya corre mucho; mejor como objetivo.',
  conditioning_minutes: 'Minutos de acondicionamiento registrados. Algo más justa que los km entre niveles.',
  benchmark_best: 'Mejor tiempo en un benchmark (menor = mejor). Favorece a los avanzados: úsala en ranking solo con grupos parecidos.',
}

export const metricHelp = (m: ChallengeMetric | undefined): string =>
  (m?.description && m.description.trim()) || (m ? METRIC_HELP[m.key] ?? '' : '')

// ── Formulario ──────────────────────────────────────────────────────────────

export type ChallengeFormValues = {
  title: string
  description: string
  cover_url: string
  prize: string
  visibility: ChallengeVisibility
  metric_key: string
  metric_params: Record<string, string>
  format: ChallengeFormat
  threshold_value: string
  start_date: string
  end_date: string
  join_deadline: string
  paid_only: boolean
  library_program_id: string
  min_participants: string
  max_participants: string
}

export const emptyForm = (): ChallengeFormValues => ({
  title: '',
  description: '',
  cover_url: '',
  prize: '',
  visibility: 'open',
  metric_key: '',
  metric_params: {},
  format: 'threshold',
  threshold_value: '',
  start_date: '',
  end_date: '',
  join_deadline: '',
  paid_only: false,
  library_program_id: '',
  min_participants: '3',
  max_participants: '',
})

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))
const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '')

export function formFromChallenge(c: Challenge): ChallengeFormValues {
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(c.metric_params ?? {})) params[k] = str(v)
  return {
    title: c.title ?? '',
    description: c.description ?? '',
    cover_url: c.cover_url ?? '',
    prize: c.prize ?? '',
    visibility: c.visibility ?? 'open',
    metric_key: c.metric_key ?? '',
    metric_params: params,
    format: c.format ?? 'threshold',
    threshold_value: str(c.threshold_value),
    start_date: day(c.start_date),
    end_date: day(c.end_date),
    join_deadline: day(c.join_deadline),
    paid_only: !!c.paid_only,
    library_program_id: str(c.library_program_id),
    min_participants: str(c.min_participants ?? 3),
    max_participants: str(c.max_participants),
  }
}

export type FormErrors = Partial<Record<keyof ChallengeFormValues | `param.${string}` | 'invites', string>>

export const WIZARD_STEPS = ['Básico', 'Métrica', 'Fechas y reglas', 'Participantes'] as const

/** En qué paso del asistente se corrige cada campo. */
export function stepOfError(key: string): number {
  if (['title', 'description', 'cover_url', 'prize', 'visibility'].includes(key)) return 0
  if (key === 'metric_key' || key === 'format' || key === 'threshold_value' || key.startsWith('param.')) return 1
  if (key === 'invites') return 3
  return 2
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
const toNum = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')))
const isPosInt = (s: string) => /^\d+$/.test(s.trim()) && Number(s) > 0

export const BENCHMARK_KEY_RE = /^[a-z0-9_]{1,64}$/

export type ValidateOptions = {
  metrics: ChallengeMetric[]
  /** YYYY-MM-DD de hoy (Madrid); se pasa para que el test no dependa del reloj. */
  today: string
  /** 'draft' valida lo mínimo para guardar; 'publish' exige todo. */
  mode: 'draft' | 'publish'
  /** Al editar un reto ya programado no se vuelve a exigir inicio ≥ hoy si no cambió. */
  originalStartDate?: string
  /** Igual para la fecha límite de inscripción ya guardada. */
  originalJoinDeadline?: string
  /** Para cerrados: clientes invitados (ya invitados + los marcados en el asistente). */
  inviteCount?: number
}

export function validateChallengeForm(v: ChallengeFormValues, opts: ValidateOptions): FormErrors {
  const e: FormErrors = {}
  const title = v.title.trim()
  if (!title) e.title = 'El título es obligatorio'
  else if (title.length < 3) e.title = 'Mínimo 3 caracteres'
  else if (title.length > 120) e.title = 'Máximo 120 caracteres'

  if (v.description.length > 2000) e.description = 'Máximo 2000 caracteres'
  if (v.prize.length > 255) e.prize = 'Máximo 255 caracteres'
  if (v.cover_url.trim()) {
    try {
      const u = new URL(v.cover_url.trim())
      if (u.protocol !== 'https:' && u.protocol !== 'http:') e.cover_url = 'La URL debe empezar por https://'
    } catch {
      e.cover_url = 'URL no válida'
    }
  }

  // En borrador basta con el título; lo demás se valida solo si está rellenado.
  const strict = opts.mode === 'publish'

  const metric = opts.metrics.find(m => m.key === v.metric_key)
  if (!v.metric_key) {
    if (strict) e.metric_key = 'Elige una métrica'
  } else if (!metric) {
    e.metric_key = 'Métrica desconocida'
  } else {
    if (!metric.formats.includes(v.format)) {
      e.format = metric.formats.includes('threshold') && !metric.formats.includes('leaderboard')
        ? 'Esta métrica solo admite formato objetivo'
        : 'Formato no permitido para esta métrica'
    }
    for (const p of metric.params) {
      const raw = (v.metric_params[p.key] ?? '').trim()
      const key = `param.${p.key}` as const
      if (!raw) {
        if (strict && p.required !== false) e[key] = 'Obligatorio'
        continue
      }
      const type = p.type ?? 'number'
      if (type === 'number' && !(toNum(raw) > 0)) e[key] = 'Debe ser un número mayor que 0'
      if (type === 'habit_template' && !isPosInt(raw)) e[key] = 'Elige un hábito'
      if (type === 'benchmark' && !p.options?.length && !BENCHMARK_KEY_RE.test(raw)) {
        e[key] = 'Solo minúsculas, números y _ (máx. 64)'
      }
    }
  }

  if (v.format === 'threshold') {
    if (v.threshold_value.trim()) {
      if (!(toNum(v.threshold_value) > 0)) e.threshold_value = 'El objetivo debe ser mayor que 0'
      else if (v.metric_key === 'adherence_pct' && toNum(v.threshold_value) > 100) e.threshold_value = 'Máximo 100 %'
    } else if (strict) e.threshold_value = 'Indica el objetivo'
  }

  if (v.start_date && !isDate(v.start_date)) e.start_date = 'Fecha no válida'
  if (v.end_date && !isDate(v.end_date)) e.end_date = 'Fecha no válida'
  if (strict && !v.start_date) e.start_date = 'Obligatoria'
  if (strict && !v.end_date) e.end_date = 'Obligatoria'
  if (!e.start_date && !e.end_date && v.start_date && v.end_date && v.end_date < v.start_date) {
    e.end_date = 'Debe ser igual o posterior al inicio'
  }
  if (strict && v.start_date && !e.start_date && v.start_date < opts.today && v.start_date !== opts.originalStartDate) {
    e.start_date = 'No puede empezar en el pasado'
  }
  if (v.join_deadline) {
    if (!isDate(v.join_deadline)) e.join_deadline = 'Fecha no válida'
    else if (v.end_date && v.join_deadline > v.end_date) e.join_deadline = 'Debe ser anterior o igual al fin'
    else if (strict && v.join_deadline < opts.today && v.join_deadline !== opts.originalJoinDeadline) e.join_deadline = 'Ya ha pasado'
  }

  const min = v.min_participants.trim()
  const max = v.max_participants.trim()
  if (min && (!/^\d+$/.test(min) || Number(min) < 2)) e.min_participants = 'Mínimo 2'
  if (strict && !min) e.min_participants = 'Obligatorio'
  if (max) {
    if (!isPosInt(max)) e.max_participants = 'Número entero mayor que 0'
    else if (!e.min_participants && min && Number(max) < Number(min)) e.max_participants = 'Debe ser ≥ mínimo'
  }

  if (strict && v.visibility === 'closed') {
    const n = opts.inviteCount ?? 0
    if (n === 0) e.invites = 'Invita al menos a un cliente'
    else if (max && !e.max_participants && n > Number(max)) e.invites = `Hay ${n} invitados y el máximo es ${max}`
  }

  return e
}

const nullIfEmpty = (s: string) => (s.trim() === '' ? null : s.trim())

/** Cuerpo para admin/challenge-store y admin/challenge-update/{id}. */
export function toPayload(v: ChallengeFormValues, metric: ChallengeMetric | undefined, status: 'draft' | 'scheduled') {
  const params: Record<string, string | number> = {}
  for (const p of metric?.params ?? []) {
    const raw = (v.metric_params[p.key] ?? '').trim()
    if (!raw) continue
    const type = p.type ?? 'number'
    params[p.key] = type === 'number' || type === 'habit_template' ? Number(raw.replace(',', '.')) : raw
  }
  return {
    title: v.title.trim(),
    description: nullIfEmpty(v.description),
    cover_url: nullIfEmpty(v.cover_url),
    prize: nullIfEmpty(v.prize),
    visibility: v.visibility,
    metric_key: v.metric_key || null,
    metric_params: params,
    format: v.format,
    threshold_value: v.format === 'threshold' && v.threshold_value.trim() ? Number(v.threshold_value.replace(',', '.')) : null,
    start_date: v.start_date || null,
    end_date: v.end_date || null,
    join_deadline: v.join_deadline || null,
    paid_only: v.paid_only,
    library_program_id: v.library_program_id ? Number(v.library_program_id) : null,
    min_participants: v.min_participants.trim() ? Number(v.min_participants) : 3,
    max_participants: v.max_participants.trim() ? Number(v.max_participants) : null,
    status,
  }
}

/** Al cambiar de métrica: se limpian los params y se fuerza un formato permitido. */
export function applyMetric(v: ChallengeFormValues, metric: ChallengeMetric): ChallengeFormValues {
  const format = metric.formats.includes(v.format) ? v.format : metric.formats[0] ?? 'threshold'
  return { ...v, metric_key: metric.key, metric_params: {}, format }
}

// ── Clientes ────────────────────────────────────────────────────────────────

export type ClientOption = { id: number; name: string; email: string; status?: string | null; user_type?: string | null }

type RawUser = {
  id: number
  name?: string | null
  display_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  status?: string | null
  user_type?: string | null
}

export function toClientOption(u: RawUser): ClientOption {
  const full = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return { id: u.id, name: u.name || u.display_name || full || u.email || `#${u.id}`, email: u.email ?? '', status: u.status ?? null, user_type: u.user_type ?? null }
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Activos, sin los que ya están en el reto, filtrados por nombre o email (sin tildes). */
export function filterInvitable(clients: ClientOption[], query: string, excludeIds: Iterable<number>): ClientOption[] {
  const ex = new Set(excludeIds)
  const q = fold(query.trim())
  return clients.filter(c =>
    (c.status == null || c.status === 'active') &&
    (c.user_type == null || c.user_type === 'user') &&
    !ex.has(c.id) &&
    (!q || fold(c.name).includes(q) || fold(c.email).includes(q)),
  )
}

// ── Detalle ─────────────────────────────────────────────────────────────────

export function formatValue(value: number | string | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  if (unit === 's' || unit === 'seconds') {
    const total = Math.round(n)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
  const txt = n.toLocaleString('es-ES', { maximumFractionDigits: 2 })
  if (!unit) return txt
  return unit === '%' ? `${txt} %` : `${txt} ${unit}`
}

/** Progreso hacia el objetivo (0-100). Usa progress_pct del backend si viene. */
export function progressPct(p: Pick<ChallengeParticipant, 'progress_pct' | 'current_value'>, c: Pick<Challenge, 'format' | 'threshold_value'>): number | null {
  if (p.progress_pct !== null && p.progress_pct !== undefined) return Math.max(0, Math.min(100, Number(p.progress_pct)))
  if (c.format !== 'threshold') return null
  const target = Number(c.threshold_value)
  const val = Number(p.current_value ?? 0)
  if (!(target > 0) || Number.isNaN(val)) return null
  return Math.max(0, Math.min(100, Math.round((val / target) * 100)))
}

const STATUS_ORDER: Record<ParticipantStatus, number> = { joined: 0, invited: 1, declined: 2, left: 3, excluded: 4 }

/** Unidos por puesto (sin puesto al final), luego invitados, abandonos y excluidos. */
export function sortParticipants(list: ChallengeParticipant[]): ChallengeParticipant[] {
  return [...list].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (s) return s
    const ra = a.rank ?? Number.POSITIVE_INFINITY
    const rb = b.rank ?? Number.POSITIVE_INFINITY
    if (ra !== rb) return ra - rb
    return (a.name ?? '').localeCompare(b.name ?? '')
  })
}

export const participantLabel = (p: Pick<ChallengeParticipant, 'name' | 'email' | 'client_id'>) =>
  p.name || p.email || `Cliente #${p.client_id}`

/**
 * Serie para el gráfico de evolución: una fila por fecha y una columna `c{client_id}`
 * por cada participante seleccionado (los `limit` mejor clasificados que estén unidos).
 */
export function buildEvolution(
  snapshots: ChallengeSnapshot[] | undefined,
  participants: ChallengeParticipant[],
  limit = 5,
): { data: Record<string, string | number | null>[]; series: ChallengeParticipant[] } {
  if (!snapshots?.length) return { data: [], series: [] }
  const withData = new Set(snapshots.map(s => s.client_id))
  const series = sortParticipants(participants)
    .filter(p => p.status === 'joined' && withData.has(p.client_id))
    .slice(0, limit)
  if (!series.length) return { data: [], series: [] }
  const ids = new Set(series.map(p => p.client_id))
  const byDate = new Map<string, Record<string, string | number | null>>()
  for (const s of snapshots) {
    if (!ids.has(s.client_id)) continue
    const date = day(s.snapshot_date)
    let row = byDate.get(date)
    if (!row) {
      row = { date }
      for (const p of series) row[`c${p.client_id}`] = null
      byDate.set(date, row)
    }
    row[`c${s.client_id}`] = Number(s.value)
  }
  const data = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  return { data, series }
}

export function todayMadrid(now = new Date()): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Normaliza respuestas `{success,data}`, paginadas `{data:{data:[]}}` o arrays planos. */
export function unwrapList<T>(res: unknown): T[] {
  const r = res as { data?: unknown } | unknown[] | null
  if (Array.isArray(r)) return r as T[]
  const d = (r as { data?: unknown } | null)?.data
  if (Array.isArray(d)) return d as T[]
  const dd = (d as { data?: unknown } | null)?.data
  return Array.isArray(dd) ? (dd as T[]) : []
}
