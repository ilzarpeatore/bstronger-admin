/**
 * Tipos de bloque (Hyrox / acondicionamiento) -- contrato compartido con el
 * backend (Bckbs App\Support\BlockKinds) y la app: /mnt/project-files/hyrox/contrato-api.md.
 *
 * Cada bloque lleva `kind` + `params` (JSON). Todos los tiempos de `params`
 * van en segundos enteros y las distancias en metros. `kind` ausente o null
 * se trata como `normal`.
 */

export type BlockKind = 'normal' | 'superserie' | 'circuito' | 'emom' | 'amrap' | 'for_time' | 'intervalos' | 'carrera'

export type BlockParams = {
  rounds?: number
  rest_after_round_sec?: number
  rest_between_exercises_sec?: number
  interval_sec?: number
  duration_sec?: number
  time_cap_sec?: number
  work_sec?: number
  rest_sec?: number
  sets?: number
  rest_between_sets_sec?: number
  mode?: 'continua' | 'intervalos'
  target_distance_m?: number
  target_time_sec?: number
  target_pace_sec_km?: number
  reps?: number
  recovery_sec?: number
  benchmark_key?: string
}

export const BLOCK_KINDS: BlockKind[] = ['normal', 'superserie', 'circuito', 'emom', 'amrap', 'for_time', 'intervalos', 'carrera']

export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  normal: 'Normal',
  superserie: 'Superserie',
  circuito: 'Circuito',
  emom: 'EMOM',
  amrap: 'AMRAP',
  for_time: 'For Time',
  intervalos: 'Intervalos',
  carrera: 'Carrera',
}

export const CONDITIONING_KINDS: BlockKind[] = ['emom', 'amrap', 'for_time', 'intervalos', 'carrera']

/** Métricas fijas por ejercicio dentro de un bloque de acondicionamiento (sin RIR/RPE por ejercicio). */
export const CONDITIONING_METRIC_KEYS = ['reps', 'carga', 'tiempo', 'distancia', 'calorias'] as const

export function normalizeKind(kind: string | null | undefined): BlockKind {
  return kind && (BLOCK_KINDS as string[]).includes(kind) ? (kind as BlockKind) : 'normal'
}

export function isConditioningKind(kind: string | null | undefined): boolean {
  return CONDITIONING_KINDS.includes(normalizeKind(kind))
}

export const TABATA_PARAMS: BlockParams = { work_sec: 20, rest_sec: 10, rounds: 8 }

/** Parámetros por defecto al elegir un tipo (null = sin parámetros). */
export function defaultParams(kind: BlockKind): BlockParams | null {
  switch (kind) {
    case 'emom': return { interval_sec: 60, rounds: 10 }
    case 'amrap': return { duration_sec: 600 }
    case 'for_time': return { rounds: 1 }
    case 'intervalos': return { ...TABATA_PARAMS }
    case 'carrera': return { mode: 'continua' }
    default: return null
  }
}

/**
 * Params para cambiar de tipo: los por defecto del nuevo tipo, conservando
 * benchmark_key (vale para cualquier tipo). null si no queda nada.
 */
export function paramsForKindChange(kind: BlockKind, previous: BlockParams | null | undefined): BlockParams | null {
  const base = defaultParams(kind) ?? {}
  const out: BlockParams = previous?.benchmark_key ? { ...base, benchmark_key: previous.benchmark_key } : base
  return Object.keys(out).length ? out : null
}

/** Quita claves vacías (undefined/null/''/NaN); null si no queda ninguna. */
export function cleanParams(params: BlockParams | null | undefined): BlockParams | null {
  if (!params) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue
    out[k] = v
  }
  return Object.keys(out).length ? (out as BlockParams) : null
}

// ---------------------------------------------------------------------------
// mm:ss
// ---------------------------------------------------------------------------

/** Segundos → "m:ss" (o "h:mm:ss" desde 1 h). */
export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || !Number.isFinite(totalSec)) return ''
  const s = Math.max(0, Math.round(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/**
 * Texto → segundos enteros. Acepta "1:30", "01:30", "1:02:03", "90",
 * "90s", "20'", "20min", "1h". Un número sin unidad se interpreta según
 * `bareUnit` (segundos por defecto). '' o texto no válido → null.
 */
export function parseDuration(text: string | number | null | undefined, bareUnit: 'sec' | 'min' = 'sec'): number | null {
  if (text === null || text === undefined) return null
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? Math.round(bareUnit === 'min' ? text * 60 : text) : null
  const t = text.trim().toLowerCase().replace(',', '.')
  if (!t) return null
  if (t.includes(':')) {
    const parts = t.split(':')
    if (parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null
    const nums = parts.map(Number)
    if (nums.slice(1).some(n => n >= 60)) return null
    return nums.reduce((acc, n) => acc * 60 + n, 0)
  }
  const m = /^(\d+(?:\.\d+)?)\s*(h|min|m|'|s|seg|")?$/.exec(t)
  if (!m) return null
  const n = parseFloat(m[1])
  const unit = m[2]
  const factor = unit === 'h' ? 3600 : unit === 'min' || unit === 'm' || unit === "'" ? 60 : unit ? 1 : bareUnit === 'min' ? 60 : 1
  return Math.round(n * factor)
}

/** Texto de distancia → metros. "800", "800m", "5km", "5,5 km" ("1.5" sin unidad = metros). */
export function parseDistance(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined) return null
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? Math.round(text) : null
  const t = text.trim().toLowerCase().replace(',', '.')
  if (!t) return null
  const m = /^(\d+(?:\.\d+)?)\s*(km|m)?$/.exec(t)
  if (!m) return null
  return Math.round(parseFloat(m[1]) * (m[2] === 'km' ? 1000 : 1))
}

/** Metros → "800 m" / "5 km" / "1,5 km". */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return ''
  if (meters >= 1000) {
    const km = Math.round(meters / 10) / 100
    return `${String(km).replace('.', ',')} km`
  }
  return `${Math.round(meters)} m`
}

/** Minutos redondos como 12', si no m:ss. */
function formatMinutes(sec: number): string {
  return sec % 60 === 0 ? `${sec / 60}'` : formatDuration(sec)
}

/** Ritmo (s/km) → "4:45/km". */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm === null || secPerKm === undefined || !Number.isFinite(secPerKm) || secPerKm <= 0) return ''
  return `${formatDuration(secPerKm)}/km`
}

// ---------------------------------------------------------------------------
// Resumen legible: «EMOM 12' · 3 ejercicios»
// ---------------------------------------------------------------------------

function kindDetail(kind: BlockKind, p: BlockParams): string {
  const pos = (n: number | undefined): n is number => typeof n === 'number' && n > 0
  switch (kind) {
    case 'superserie':
    case 'circuito': {
      const parts = [BLOCK_KIND_LABELS[kind]]
      if (pos(p.rounds)) parts.push(`× ${p.rounds} ${p.rounds === 1 ? 'ronda' : 'rondas'}`)
      return parts.join(' ')
    }
    case 'emom': {
      const interval = pos(p.interval_sec) ? p.interval_sec : 60
      const name = interval === 60 ? 'EMOM' : interval % 60 === 0 ? `E${interval / 60}MOM` : `EMOM cada ${formatDuration(interval)}`
      return pos(p.rounds) ? `${name} ${formatMinutes(interval * p.rounds)}` : name
    }
    case 'amrap':
      return pos(p.duration_sec) ? `AMRAP ${formatMinutes(p.duration_sec)}` : 'AMRAP'
    case 'for_time': {
      let s = 'For Time'
      if (pos(p.rounds) && p.rounds > 1) s += ` ${p.rounds} rondas`
      if (pos(p.time_cap_sec)) s += ` · límite ${formatMinutes(p.time_cap_sec)}`
      return s
    }
    case 'intervalos': {
      const isTabata = p.work_sec === 20 && p.rest_sec === 10 && p.rounds === 8
      let s = isTabata ? 'Tabata' : 'Intervalos'
      if (pos(p.work_sec)) s += ` ${p.work_sec}/${p.rest_sec ?? 0}`
      if (pos(p.rounds)) s += ` × ${p.rounds}`
      if (pos(p.sets) && p.sets > 1) s += ` · ${p.sets} series`
      return s
    }
    case 'carrera': {
      const parts: string[] = []
      if (p.mode === 'intervalos' && pos(p.reps)) {
        const each = pos(p.target_distance_m) ? formatDistance(p.target_distance_m) : pos(p.target_time_sec) ? formatMinutes(p.target_time_sec) : ''
        parts.push(`Carrera ${p.reps} × ${each}`.trim())
        if (pos(p.recovery_sec)) parts.push(`rec ${formatDuration(p.recovery_sec)}`)
      } else {
        const target = [pos(p.target_distance_m) ? formatDistance(p.target_distance_m) : '', pos(p.target_time_sec) ? formatMinutes(p.target_time_sec) : '']
          .filter(Boolean).join(' / ')
        parts.push(target ? `Carrera ${target}` : 'Carrera')
      }
      if (pos(p.target_pace_sec_km)) parts.push(`@ ${formatPace(p.target_pace_sec_km)}`)
      return parts.join(' · ')
    }
    default:
      return BLOCK_KIND_LABELS[kind]
  }
}

/**
 * Resumen de la cabecera del bloque. Para `normal` devuelve null (la cabecera
 * ya muestra el nº de ejercicios).
 */
export function blockKindSummary(kind: string | null | undefined, params: BlockParams | null | undefined, exerciseCount?: number): string | null {
  const k = normalizeKind(kind)
  if (k === 'normal') return null
  const parts = [kindDetail(k, params ?? {})]
  if (exerciseCount !== undefined) parts.push(`${exerciseCount} ${exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}`)
  return parts.join(' · ')
}
