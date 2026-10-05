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

export type ConditioningStats = {
  weeks: number
  weekly_km: { week_start: string; km: number }[]
  weekly_minutes: { week_start: string; minutes: number }[]
  avg_pace_sec_km: number | null
  conditioning_minutes: number
  total_km: number
  results_count: number
  benchmarks: Record<string, BenchmarkEntry[]>
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
  }
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
