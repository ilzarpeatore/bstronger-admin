// Dashboard de KPIs de un macrociclo (página /macrociclos/dashboard).
// Solo datos PLANIFICADOS por el coach (GET /admin/macrocycle-plan, Bckbs
// MacrocyclePlanService), nunca lo registrado por el cliente. Aquí se agregan
// por semana, por mesociclo o para todo el macrociclo, según el selector.

export type PlanProgram = { id: number; title: string; mesocycle_number: number | null; num_weeks: number | null }

export type PlanSession = {
  assignment_id: number
  program_id: number
  week: number
  day: number
  is_deload: boolean
  session: string
}

export type PlanRow = {
  assignment_id: number
  exercise_id: number
  exercise_title: string
  block_title: string | null
  muscle: string | null
  series: string | null
  reps: string | null
  rir: string | null
  rpe: string | null
  carga: string | null
  carga_pct: string | null
  descanso: string | null
}

export type PlanData = {
  programs: PlanProgram[]
  sessions: PlanSession[]
  rows: PlanRow[]
  /** grupo primario => { músculo => multiplicador } para las series indirectas */
  muscle_splits: Record<string, Record<string, number>>
  skipped_ids: number[]
}

export type Granularity = 'week' | 'meso' | 'macro'
export type SetsMode = 'direct' | 'indirect'
export type CargaKind = 'subir' | 'mantener' | 'bajar' | 'fija' | 'sin'
export const CARGA_KINDS: CargaKind[] = ['subir', 'mantener', 'bajar', 'fija', 'sin']

export type References = Record<string, { mev: number | null; mrv: number | null }>

export const NO_MUSCLE = 'Sin grupo muscular'

type Stat = { sum: number; weight: number; min: number; max: number }

export type Bucket = {
  key: string
  label: string
  programIds: number[]
  /** semanas (programa + nº de semana) distintas con al menos una sesión */
  weeks: number
  deloadWeeks: number
  sessions: number
  exercises: number
  totalSets: number
  /** series totales / semanas: comparable con MEV/MRV (que son semanales) */
  setsPerWeek: number
  /** series por músculo, TOTALES del bucket */
  directSets: Record<string, number>
  indirectSets: Record<string, number>
  rir: Stat | null
  rpe: Stat | null
  reps: Stat | null
  carga: Record<CargaKind, number>
  isDeload: boolean
}

/**
 * Valor numérico de un campo de `prescribed`: "3" → 3, "8-10" → 9, "7,5" → 7.5,
 * "3→2→1→FALLO" → 1.5 (fallo cuenta como 0). Texto sin números ("AMRAP") → null.
 */
export function parseNumeric(value: string | null | undefined): number | null {
  if (value == null) return null
  const s = String(value).toLowerCase()
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map(n => parseFloat(n.replace(',', '.')))
  if (/fallo|failure/.test(s)) nums.push(0)
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** Indicación de carga del coach: "Subir"/"Mantener"/"Bajar", un valor fijo (kg o %), o nada. */
export function cargaKind(carga: string | null | undefined, cargaPct?: string | null): CargaKind {
  const s = (carga ?? '').trim().toLowerCase()
  if (s.startsWith('sub') || s.includes('subir') || s.startsWith('+')) return 'subir'
  if (s.startsWith('man') || s.includes('mantener') || s === '=') return 'mantener'
  if (s.startsWith('baj') || s.includes('bajar') || s.startsWith('-')) return 'bajar'
  if (/\d/.test(s) || (cargaPct ?? '').trim() !== '') return 'fija'
  return 'sin'
}

export function mesoLabel(program: PlanProgram, index: number): string {
  return `M${program.mesocycle_number ?? index + 1}`
}

function addStat(stat: Stat | null, value: number | null, weight: number): Stat | null {
  if (value == null) return stat
  if (!stat) return { sum: value * weight, weight, min: value, max: value }
  return { sum: stat.sum + value * weight, weight: stat.weight + weight, min: Math.min(stat.min, value), max: Math.max(stat.max, value) }
}

export function statAvg(stat: Stat | null): number | null {
  return stat && stat.weight > 0 ? stat.sum / stat.weight : null
}

function emptyBucket(key: string, label: string): Bucket {
  return {
    key,
    label,
    programIds: [],
    weeks: 0,
    deloadWeeks: 0,
    sessions: 0,
    exercises: 0,
    totalSets: 0,
    setsPerWeek: 0,
    directSets: {},
    indirectSets: {},
    rir: null,
    rpe: null,
    reps: null,
    carga: { subir: 0, mantener: 0, bajar: 0, fija: 0, sin: 0 },
    isDeload: false,
  }
}

/**
 * Agrupa lo planificado de los mesociclos seleccionados en buckets:
 * una semana (M1 S1, M1 S2…), un mesociclo (M1, M2…) o todo el macrociclo.
 */
export function computeBuckets(data: PlanData, granularity: Granularity, selectedProgramIds: number[]): Bucket[] {
  const selected = new Set(selectedProgramIds)
  const programs = data.programs.filter(p => selected.has(p.id))
  const programIndex = new Map(data.programs.map((p, i) => [p.id, i]))
  const labelOf = new Map(data.programs.map((p, i) => [p.id, mesoLabel(p, i)]))

  const bucketKeyOf = (programId: number, week: number) =>
    granularity === 'week' ? `${programId}:${week}` : granularity === 'meso' ? `${programId}` : 'macro'

  const buckets = new Map<string, Bucket>()
  const order: string[] = []
  const ensure = (programId: number, week: number) => {
    const key = bucketKeyOf(programId, week)
    let b = buckets.get(key)
    if (!b) {
      const meso = labelOf.get(programId) ?? '?'
      const label = granularity === 'week' ? `${meso} S${week}` : granularity === 'meso' ? meso : 'Macrociclo'
      b = emptyBucket(key, label)
      buckets.set(key, b)
      order.push(key)
    }
    if (!b.programIds.includes(programId)) b.programIds.push(programId)
    return b
  }

  // Semanas en orden del macrociclo (mesociclo, luego semana)
  const sessions = data.sessions
    .filter(s => selected.has(s.program_id))
    .sort((a, b) => (programIndex.get(a.program_id) ?? 0) - (programIndex.get(b.program_id) ?? 0) || a.week - b.week || a.day - b.day)

  const sessionById = new Map(sessions.map(s => [s.assignment_id, s]))
  const weeksSeen = new Map<string, Set<string>>()
  const deloadSeen = new Map<string, Set<string>>()

  for (const s of sessions) {
    const b = ensure(s.program_id, s.week)
    b.sessions += 1
    const weekKey = `${s.program_id}:${s.week}`
    if (!weeksSeen.has(b.key)) weeksSeen.set(b.key, new Set())
    weeksSeen.get(b.key)!.add(weekKey)
    if (s.is_deload) {
      if (!deloadSeen.has(b.key)) deloadSeen.set(b.key, new Set())
      deloadSeen.get(b.key)!.add(weekKey)
    }
  }

  for (const row of data.rows) {
    const s = sessionById.get(row.assignment_id)
    if (!s) continue
    const b = ensure(s.program_id, s.week)
    const sets = parseNumeric(row.series) ?? 0
    const weight = sets > 0 ? sets : 1

    b.exercises += 1
    b.totalSets += sets

    const muscle = row.muscle ?? NO_MUSCLE
    b.directSets[muscle] = (b.directSets[muscle] ?? 0) + sets
    const split = row.muscle ? data.muscle_splits[row.muscle] : undefined
    for (const [m, mult] of Object.entries(split ?? { [muscle]: 1 })) {
      b.indirectSets[m] = (b.indirectSets[m] ?? 0) + sets * mult
    }

    b.rir = addStat(b.rir, parseNumeric(row.rir), weight)
    b.rpe = addStat(b.rpe, parseNumeric(row.rpe), weight)
    b.reps = addStat(b.reps, parseNumeric(row.reps), weight)
    b.carga[cargaKind(row.carga, row.carga_pct)] += 1
  }

  const out = order.map(k => buckets.get(k)!).filter(b => programs.some(p => b.programIds.includes(p.id)))
  for (const b of out) {
    b.weeks = weeksSeen.get(b.key)?.size ?? 0
    b.deloadWeeks = deloadSeen.get(b.key)?.size ?? 0
    b.isDeload = granularity === 'week' && b.deloadWeeks > 0
    b.setsPerWeek = b.weeks > 0 ? b.totalSets / b.weeks : b.totalSets
  }
  return out
}

/** Series por semana de un músculo en un bucket (media si el bucket tiene varias semanas). */
export function muscleSetsPerWeek(b: Bucket, muscle: string, mode: SetsMode): number {
  const total = (mode === 'direct' ? b.directSets : b.indirectSets)[muscle] ?? 0
  return b.weeks > 0 ? total / b.weeks : total
}

export type RangeStatus = 'low' | 'ok' | 'high' | null

export function rangeStatus(value: number, ref: { mev: number | null; mrv: number | null } | undefined): RangeStatus {
  if (!ref || (ref.mev == null && ref.mrv == null)) return null
  if (ref.mev != null && value < ref.mev) return 'low'
  if (ref.mrv != null && value > ref.mrv) return 'high'
  return 'ok'
}

/** Músculos presentes en los buckets, ordenados por volumen total descendente. */
export function musclesOf(buckets: Bucket[], mode: SetsMode): string[] {
  const totals: Record<string, number> = {}
  for (const b of buckets) {
    for (const [m, v] of Object.entries(mode === 'direct' ? b.directSets : b.indirectSets)) totals[m] = (totals[m] ?? 0) + v
  }
  return Object.keys(totals)
    .filter(m => totals[m] > 0)
    .sort((a, b) => (a === NO_MUSCLE ? 1 : b === NO_MUSCLE ? -1 : totals[b] - totals[a]))
}

export function round1(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return (Math.round(n * 10) / 10).toLocaleString('es-ES')
}
