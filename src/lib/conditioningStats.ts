/**
 * Estadísticas de acondicionamiento de un cliente:
 * GET admin/clients/{id}/conditioning-stats?weeks=N (Bckbs ConditioningStatsService,
 * mismo formato que v1/client-calendar/conditioning-stats de la app).
 */
import { formatDistance, formatDuration } from './blockKinds'

export type BenchmarkEntry = {
  id?: number
  performed_date: string
  kind?: string | null
  score_type?: string | null
  time_sec?: number | null
  rounds?: number | null
  extra_reps?: number | null
  distance_m?: number | null
  capped?: boolean | null
  rpe?: number | null
}

/** Parcial comparado con el del resultado anterior (fase 2). */
export type SplitComparison = {
  index: number
  label: string
  is_run: boolean
  t_sec: number | null
  previous_t_sec: number | null
  diff_sec: number | null
}

export type SplitAnalysis = {
  runs: { count: number; avg_t_sec: number; fastest_t_sec?: number; slowest: { label: string; position: number; t_sec: number; diff_vs_avg_sec: number } } | null
  slowest_station: { label: string; position: number; t_sec: number; avg_t_sec: number | null; diff_vs_avg_sec: number | null; basis: 'media_propia' | 'mas_larga' } | null
  runs_sec?: number
  stations_sec?: number
}

export type BlockComparison = {
  previous: BenchmarkEntry | null
  total_diff_sec: number | null
  splits: SplitComparison[]
  analysis: SplitAnalysis | null
}

export type LastSimulation = BlockComparison & { benchmark_key: string; current: BenchmarkEntry }

export type ConditioningStats = {
  weeks: number
  weekly_km: { week_start: string; km: number }[]
  weekly_minutes: { week_start: string; minutes: number }[]
  avg_pace_sec_km: number | null
  conditioning_minutes: number
  total_km: number
  results_count: number
  benchmarks: Record<string, BenchmarkEntry[]>
  // Fase 2 (opcionales: un backend sin fase 2 no los manda).
  weekly_pace: { week_start: string; pace_sec_km: number | null }[]
  pace_change_sec_km: number | null
  hr_max_estimate: number | null
  hr_zone_minutes: { zone: number; minutes: number }[] | null
  last_simulation: LastSimulation | null
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

/** Acepta `{success, data}` o el objeto directo; tolera campos ausentes. null si no hay nada utilizable. */
export function normalizeConditioningStats(raw: unknown): ConditioningStats | null {
  const r = raw as Record<string, any> | null | undefined
  const d = (r && typeof r === 'object' && 'data' in r ? r.data : r) as Record<string, any> | null | undefined
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null
  const weeklyKm = Array.isArray(d.weekly_km) ? d.weekly_km : []
  const weeklyMin = Array.isArray(d.weekly_minutes) ? d.weekly_minutes : []
  const benchmarks: Record<string, BenchmarkEntry[]> = {}
  if (d.benchmarks && typeof d.benchmarks === 'object' && !Array.isArray(d.benchmarks)) {
    for (const [k, list] of Object.entries(d.benchmarks as Record<string, unknown>)) {
      if (Array.isArray(list) && list.length) {
        benchmarks[k] = [...(list as BenchmarkEntry[])].sort((a, b) => String(a.performed_date).localeCompare(String(b.performed_date)))
      }
    }
  }
  return {
    weeks: num(d.weeks) ?? weeklyKm.length,
    weekly_km: weeklyKm.map((w: any) => ({ week_start: String(w.week_start), km: num(w.km) ?? 0 })),
    weekly_minutes: weeklyMin.map((w: any) => ({ week_start: String(w.week_start), minutes: num(w.minutes) ?? 0 })),
    avg_pace_sec_km: num(d.avg_pace_sec_km),
    conditioning_minutes: num(d.conditioning_minutes) ?? 0,
    total_km: num(d.total_km) ?? weeklyKm.reduce((s: number, w: any) => s + (num(w.km) ?? 0), 0),
    results_count: num(d.results_count) ?? 0,
    benchmarks,
    weekly_pace: Array.isArray(d.weekly_pace) ? d.weekly_pace.map((w: any) => ({ week_start: String(w.week_start), pace_sec_km: num(w.pace_sec_km) })) : [],
    pace_change_sec_km: num(d.pace_change_sec_km),
    hr_max_estimate: num(d.hr_max_estimate),
    hr_zone_minutes: Array.isArray(d.hr_zone_minutes)
      ? d.hr_zone_minutes.map((z: any) => ({ zone: num(z.zone) ?? 0, minutes: num(z.minutes) ?? 0 })).filter((z: { zone: number }) => z.zone >= 1 && z.zone <= 5)
      : null,
    last_simulation: normalizeComparison(d.last_simulation) as LastSimulation | null,
  }
}

/** Normaliza `comparison` (block-result / .../comparison / last_simulation). null si no es un objeto. */
export function normalizeComparison(raw: unknown): BlockComparison | null {
  const c = raw as Record<string, any> | null | undefined
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null
  const splits: SplitComparison[] = Array.isArray(c.splits)
    ? c.splits.map((x: any, i: number) => ({
        index: num(x.index) ?? i,
        label: String(x.label ?? `Paso ${i + 1}`),
        is_run: Boolean(x.is_run),
        t_sec: num(x.t_sec),
        previous_t_sec: num(x.previous_t_sec),
        diff_sec: num(x.diff_sec),
      }))
    : []
  return { ...c, previous: c.previous ?? null, total_diff_sec: num(c.total_diff_sec), splits, analysis: c.analysis ?? null } as BlockComparison
}

/** Diferencia de tiempo con signo: «−0:12» (mejor) / «+1:05» (peor) / «=». */
export function formatDiff(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return ''
  if (sec === 0) return '='
  const abs = Math.abs(Math.round(sec))
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${sec < 0 ? '−' : '+'}${m}:${String(s).padStart(2, '0')}`
}

export const HR_ZONE_LABELS: Record<number, string> = {
  1: 'Z1 recuperación',
  2: 'Z2 aeróbico',
  3: 'Z3 tempo',
  4: 'Z4 umbral',
  5: 'Z5 máximo',
}

export function hasConditioningData(s: ConditioningStats | null): boolean {
  if (!s) return false
  return s.results_count > 0 || s.total_km > 0 || s.conditioning_minutes > 0 || Object.keys(s.benchmarks).length > 0
}

export type ScoreKind = 'time' | 'rounds' | 'distance'

/** Qué se grafica de un benchmark: tiempo (menos es mejor), rondas (+reps) o distancia. */
export function benchmarkScoreKind(entries: BenchmarkEntry[]): ScoreKind {
  const types = entries.map(e => e.score_type).filter(Boolean)
  if (types.includes('rounds_reps')) return 'rounds'
  if (types.includes('time') || types.includes('distance_time') || entries.some(e => e.time_sec)) return 'time'
  return 'distance'
}

/** Valor numérico para el eje Y. En rondas, las reps extra suman reps/100 (solo para ordenar y dibujar; el texto sale de benchmarkLabel). */
export function benchmarkValue(e: BenchmarkEntry, kind: ScoreKind): number | null {
  if (kind === 'time') return num(e.time_sec)
  if (kind === 'rounds') {
    const r = num(e.rounds)
    if (r === null) return null
    return r + (num(e.extra_reps) ?? 0) / 100
  }
  return num(e.distance_m)
}

/** Texto del resultado: «23:41», «5 + 12», «5 km en 24:10», con «(límite)» si llegó al time cap. */
export function benchmarkLabel(e: BenchmarkEntry): string {
  const parts: string[] = []
  if (e.rounds !== null && e.rounds !== undefined) parts.push(e.extra_reps ? `${e.rounds} + ${e.extra_reps}` : `${e.rounds} rondas`)
  if (e.distance_m) parts.push(formatDistance(e.distance_m))
  if (e.time_sec) parts.push(e.distance_m ? `en ${formatDuration(e.time_sec)}` : formatDuration(e.time_sec))
  let s = parts.join(' ') || '—'
  if (e.capped) s += ' (límite)'
  return s
}

/** «hyrox_full_sim» → «Hyrox full sim». */
export function benchmarkTitle(key: string): string {
  const t = key.replace(/[_-]+/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : key
}
