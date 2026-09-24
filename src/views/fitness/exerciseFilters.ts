// Filtros de la lista de ejercicios del panel (/exercises). Todo se filtra en
// cliente sobre la lista completa que ya carga ExerciseView (per_page=-1,
// ~1600 filas) -- no hace falta endpoint nuevo.
//
// Los filtros se agrupan por TIPO (ver FILTER_GROUPS) para que el panel los
// muestre clasificados: qué es el ejercicio (clasificación), cómo se registra,
// acceso/estado, contenido multimedia y datos incompletos.

export type ExerciseFilterable = {
  id: number
  title: string
  exercise_image: string | null
  level_id: number | null
  equipment_id: number | null
  bodypart_ids: number[] | number | null
  type: string | null
  exercise_type: string | null
  based: string | null
  seconds_per_rep: number | null
  is_premium: boolean | number | string
  status: string | null
  instruction: string | null
  tips: string | null
  video_url: string | null
  video_type: string | null
  created_at?: string
  updated_at?: string
}

/** 'any' = no filtrar; 'yes' = debe tenerlo; 'no' = no debe tenerlo. */
export type TriState = 'any' | 'yes' | 'no'

export type MissingField = 'bodypart' | 'equipment' | 'level' | 'category' | 'record_type'

export type ExerciseSort = 'title' | 'recent' | 'updated'

export type ExerciseFilterState = {
  // Clasificación
  bodyParts: number[]
  equipment: number[]
  levels: number[]
  categories: string[]
  // Registro y medición
  based: string[]
  recordType: string[]
  hasTempo: TriState
  // Acceso y estado
  premium: 'all' | 'free' | 'premium'
  status: string[]
  // Contenido y multimedia
  hasImage: TriState
  hasVideo: TriState
  hasInstruction: TriState
  hasTips: TriState
  // Datos incompletos (el ejercicio NO tiene ese dato)
  missing: MissingField[]
  sort: ExerciseSort
}

export const EMPTY_FILTERS: ExerciseFilterState = {
  bodyParts: [],
  equipment: [],
  levels: [],
  categories: [],
  based: [],
  recordType: [],
  hasTempo: 'any',
  premium: 'all',
  status: [],
  hasImage: 'any',
  hasVideo: 'any',
  hasInstruction: 'any',
  hasTips: 'any',
  missing: [],
  sort: 'title',
}

export const BASED_LABELS: Record<string, string> = { reps: 'Repeticiones', time: 'Tiempo' }
export const RECORD_TYPE_LABELS: Record<string, string> = { sets: 'Series', duration: 'Duración' }
export const STATUS_LABELS: Record<string, string> = { active: 'Activo', inactive: 'Inactivo' }

export const MISSING_LABELS: Record<MissingField, string> = {
  bodypart: 'Sin grupo muscular',
  equipment: 'Sin equipamiento',
  level: 'Sin nivel',
  category: 'Sin categoría',
  record_type: 'Sin tipo de registro',
}

const filled = (value: string | null | undefined) => !!value && value.trim() !== ''

export function bodyPartIdsOf(item: ExerciseFilterable): number[] {
  const raw = item.bodypart_ids
  if (Array.isArray(raw)) return raw.map(Number).filter(n => Number.isFinite(n))
  if (typeof raw === 'number' && Number.isFinite(raw)) return [raw]
  return []
}

export function isPremium(item: ExerciseFilterable): boolean {
  return item.is_premium === true || item.is_premium === 1 || item.is_premium === '1'
}

const triMatches = (state: TriState, has: boolean) =>
  state === 'any' || (state === 'yes' ? has : !has)

/** Predicados atómicos, reutilizados para contar opciones y para filtrar. */
export const HAS = {
  image: (e: ExerciseFilterable) => filled(e.exercise_image),
  video: (e: ExerciseFilterable) => filled(e.video_url),
  instruction: (e: ExerciseFilterable) => filled(e.instruction),
  tips: (e: ExerciseFilterable) => filled(e.tips),
  tempo: (e: ExerciseFilterable) => e.seconds_per_rep != null && Number(e.seconds_per_rep) > 0,
}

export const MISSING: Record<MissingField, (e: ExerciseFilterable) => boolean> = {
  bodypart: e => bodyPartIdsOf(e).length === 0,
  equipment: e => e.equipment_id == null,
  level: e => e.level_id == null,
  category: e => !filled(e.exercise_type),
  record_type: e => !filled(e.type),
}

export function matchesFilters(e: ExerciseFilterable, f: ExerciseFilterState): boolean {
  if (f.bodyParts.length) {
    const ids = bodyPartIdsOf(e)
    if (!f.bodyParts.some(id => ids.includes(id))) return false
  }
  if (f.equipment.length && (e.equipment_id == null || !f.equipment.includes(e.equipment_id))) return false
  if (f.levels.length && (e.level_id == null || !f.levels.includes(e.level_id))) return false
  if (f.categories.length && !(e.exercise_type && f.categories.includes(e.exercise_type))) return false
  if (f.based.length && !(e.based && f.based.includes(e.based))) return false
  if (f.recordType.length && !(e.type && f.recordType.includes(e.type))) return false
  if (!triMatches(f.hasTempo, HAS.tempo(e))) return false
  if (f.premium === 'premium' && !isPremium(e)) return false
  if (f.premium === 'free' && isPremium(e)) return false
  if (f.status.length && !f.status.includes(e.status ?? '')) return false
  if (!triMatches(f.hasImage, HAS.image(e))) return false
  if (!triMatches(f.hasVideo, HAS.video(e))) return false
  if (!triMatches(f.hasInstruction, HAS.instruction(e))) return false
  if (!triMatches(f.hasTips, HAS.tips(e))) return false
  // Datos incompletos: se combinan con "o" (le falta alguno de los marcados).
  if (f.missing.length && !f.missing.some(m => MISSING[m](e))) return false
  return true
}

export function applyExerciseFilters<T extends ExerciseFilterable>(items: T[], f: ExerciseFilterState): T[] {
  const filtered = items.filter(e => matchesFilters(e, f))
  const byTitle = (a: T, b: T) => (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' })
  const time = (s?: string) => (s ? Date.parse(s) || 0 : 0)
  if (f.sort === 'recent') return filtered.sort((a, b) => time(b.created_at) - time(a.created_at) || b.id - a.id)
  if (f.sort === 'updated') return filtered.sort((a, b) => time(b.updated_at) - time(a.updated_at) || b.id - a.id)
  return filtered.sort(byTitle)
}

/** Nº de filtros activos (el orden no cuenta). */
export function countActiveFilters(f: ExerciseFilterState): number {
  const tri = [f.hasTempo, f.hasImage, f.hasVideo, f.hasInstruction, f.hasTips].filter(v => v !== 'any').length
  return (
    f.bodyParts.length + f.equipment.length + f.levels.length + f.categories.length +
    f.based.length + f.recordType.length + f.status.length + f.missing.length +
    tri + (f.premium !== 'all' ? 1 : 0)
  )
}

/** Cuántos ejercicios cumplen un predicado -- para mostrar el contador de cada opción. */
export function countWhere<T>(items: T[], predicate: (e: T) => boolean): number {
  let n = 0
  for (const e of items) if (predicate(e)) n++
  return n
}

export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}
