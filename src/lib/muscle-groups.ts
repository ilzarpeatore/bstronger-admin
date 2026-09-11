import { api } from '@/lib/api'

type ExerciseCatalogItem = {
  id: number
  title: string
  bodypart_names: string | null
  bodypart_ids?: number[] | string | null
}

type BodyPartMeta = { id: number; title: string }

export type MuscleCatalogStats = {
  catalogSize: number
  exercisesWithBodyparts: number
}

export type CatalogEntry = {
  id: number
  title: string
  groups: string[]
}

let catalogCache: Map<number, string[]> | null = null
let catalogPromise: Promise<Map<number, string[]>> | null = null
let catalogStats: MuscleCatalogStats | null = null
let allGroupsCache: string[] | null = null
let catalogEntriesCache: CatalogEntry[] | null = null

// Grupos musculares canonicos que SIEMPRE aparecen en la app, aunque todavia
// no existan como "body part" en el backend. Se fusionan con los del backend
// (evitando duplicados por nombre, ignorando acentos y mayusculas).
export const DEFAULT_MUSCLE_GROUPS = [
  'Pecho',
  'Bíceps',
  'Tríceps',
  'Antebrazo',
  'Trapecios',
  'Hombros',
  'Deltoides lateral',
  'Deltoides anterior',
  'Deltoides posterior',
  'Espalda alta',
  'Dorsales',
  'Lumbar',
  'Core',
  'Abdominales',
  'Oblicuos',
  'Cuádriceps',
  'Isquiotibiales',
  'Gluteo',
  'Gluteo medio',
  'Gluteo mayor',
  'Gluteo menor',
  'Gemelos',
  'Aductores',
  'Abductores',
  'Tibial anterior',
  'Cuello',
  'Cuerpo completo',
]

function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// Fusiona la lista canonica con nombres del backend, sin duplicados.
function mergeMuscleNames(...lists: string[][]): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    for (const name of list) {
      if (!name) continue
      const key = normalizeName(name)
      if (seen.has(key)) continue
      seen.add(key)
      result.push(name)
    }
  }
  return result
}

// La API devuelve el cuerpo como { data: [...], pagination: {...} } o, para
// endpoints no paginados, directamente un array. Normaliza ambas formas.
function paginatedItems(res: any): any[] {
  if (!res) return []
  if (Array.isArray(res)) return res
  if (Array.isArray(res.data)) return res.data
  return res.data?.data || []
}

function parseBodypartIds(ids: number[] | string | null | undefined): number[] {
  if (ids == null) return []
  if (Array.isArray(ids)) return ids.map(Number).filter(Number.isFinite)
  if (typeof ids === 'string') {
    const raw = ids.trim()
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite)
    } catch {
      // no es JSON, intentar separar por comas
    }
    return raw.split(',').map(s => Number(s.trim())).filter(Number.isFinite)
  }
  return []
}

export function parseBodyparts(names: string | null): string[] {
  if (!names) return []
  const raw = names.trim()
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      const list = Array.isArray(parsed) ? parsed : (parsed as any)?.primary
      if (Array.isArray(list)) return list.map(String).map(s => s.trim()).filter(Boolean)
    } catch {
      // no es JSON valido, caer al split por comas
    }
  }
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

export function primaryBodypart(names: string[]): string | null {
  return names.length > 0 ? names[0] : null
}

async function fetchBodyPartTitles(): Promise<Map<number, string>> {
  const res = await api.get('/admin/body-parts?per_page=-1')
  const items: BodyPartMeta[] = paginatedItems(res)
  const map = new Map<number, string>()
  for (const item of items) {
    if (item && item.id != null && item.title) map.set(Number(item.id), item.title)
  }
  return map
}

async function fetchAllBodyPartNames(): Promise<string[]> {
  try {
    const res = await api.get('/admin/body-parts?per_page=-1')
    return paginatedItems(res)
      .map((b: BodyPartMeta) => b?.title)
      .filter((t): t is string => Boolean(t))
  } catch {
    return []
  }
}

async function fetchAllExercises(): Promise<ExerciseCatalogItem[]> {
  const first = await api.get('/admin/exercises?per_page=200')
  const items = paginatedItems(first)
  const totalPages = first?.pagination?.totalPages ?? 1

  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        api.get(`/admin/exercises?per_page=200&page=${i + 2}`),
      ),
    )
    for (const pageRes of rest) items.push(...paginatedItems(pageRes))
  }

  return items
}

// Catalogo global de ejercicios (id -> grupos musculares). Se cachea a nivel
// de modulo para no repetir la peticion en cada vista que clasifique volumen.
// Combina bodypart_names (si viene) con la relacion canonica bodypart_ids ->
// /admin/body-parts, y recorre todas las paginas del catalogo.
export function fetchExerciseBodyparts(): Promise<Map<number, string[]>> {
  if (catalogCache) return Promise.resolve(catalogCache)
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const [titleMap, bodyPartNames, items] = await Promise.all([fetchBodyPartTitles(), fetchAllBodyPartNames(), fetchAllExercises()])
      const map = new Map<number, string[]>()
      let withBodyparts = 0
      const catalogNames: string[] = []
      for (const item of items) {
        const fromNames = parseBodyparts(item.bodypart_names)
        catalogNames.push(...fromNames)
        const fromIds = parseBodypartIds(item.bodypart_ids)
          .map(id => titleMap.get(id))
          .filter((t): t is string => Boolean(t))
        const merged = Array.from(new Set([...fromNames, ...fromIds]))
        if (merged.length > 0) withBodyparts += 1
        map.set(Number(item.id), merged)
      }
      catalogStats = { catalogSize: items.length, exercisesWithBodyparts: withBodyparts }
      allGroupsCache = mergeMuscleNames(DEFAULT_MUSCLE_GROUPS, bodyPartNames, catalogNames)
      catalogEntriesCache = items.map(item => ({
        id: Number(item.id),
        title: item.title,
        groups: map.get(Number(item.id)) ?? [],
      }))
      catalogCache = map
      return map
    })().catch(err => {
      catalogPromise = null
      throw err
    })
  }
  return catalogPromise
}

export function getMuscleCatalogStats(): MuscleCatalogStats | null {
  return catalogStats
}

// Lista completa de grupos musculares conocidos: la canonica DEFAULT_MUSCLE_GROUPS
// mas los de /admin/body-parts y los que solo aparecen como bodypart_names en el
// catalogo de ejercicios (sin duplicados). Si el backend falla, devuelve la canonica.
export function getAllMuscleGroups(): Promise<string[]> {
  return fetchExerciseBodyparts()
    .then(() => allGroupsCache ?? DEFAULT_MUSCLE_GROUPS)
    .catch(() => DEFAULT_MUSCLE_GROUPS)
}

// Inventario completo del catalogo (id, titulo, grupos asignados), util para
// diagnosticar que ejercicios faltan por clasificar y calibrar los multiplicadores.
export function fetchExerciseCatalogEntries(): Promise<CatalogEntry[]> {
  return fetchExerciseBodyparts()
    .then(() => catalogEntriesCache ?? [])
    .catch(() => [])
}
