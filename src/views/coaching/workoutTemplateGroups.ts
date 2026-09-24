// Organización de la lista de /workout-templates: las sesiones generadas por
// un import/generador de semanas se llaman "<Programa> · <Sesión> (S<semana>)"
// (a veces con más "·" dentro del nombre del programa), así que se agrupan en
// "carpetas" por el nombre del programa. No hay endpoint nuevo: todo sale del
// título y de los campos que ya devuelve workout-template-list.

export type TemplateListItem = {
  id: number
  title: string
  description: string | null
  is_exclusive?: boolean
  is_public?: boolean
  exercise_count?: number
  thumbnail?: string | null
  created_at?: string
}

export type DecoratedItem = TemplateListItem & {
  /** Nombre del programa ("carpeta"); null si el título no sigue el patrón. */
  folder: string | null
  /** Parte del título tras la carpeta, ej. "Empuje (S1)". */
  session: string
  /** Semana extraída de "(S3)"; null si no hay. */
  week: number | null
  /** Otra plantilla más reciente de la misma carpeta tiene exactamente este título. */
  isDuplicate: boolean
}

export const FOLDER_SEPARATOR = ' · '
export const LOOSE_FOLDER_LABEL = 'Sueltas (sin programa)'

export function splitTitle(title: string): { folder: string | null; session: string; week: number | null } {
  const idx = title.lastIndexOf(FOLDER_SEPARATOR)
  const folder = idx > 0 ? title.slice(0, idx).trim() : null
  const session = idx > 0 ? title.slice(idx + FOLDER_SEPARATOR.length).trim() : title.trim()
  const m = session.match(/\(S(\d+)\)\s*$/i)
  return { folder, session, week: m ? Number(m[1]) : null }
}

/** Marca duplicadas (mismo título dentro de la misma carpeta): solo la de id mayor se considera vigente. */
export function decorate(items: TemplateListItem[]): DecoratedItem[] {
  const newest = new Map<string, number>()
  for (const it of items) {
    const key = it.title.trim().toLowerCase()
    if ((newest.get(key) ?? -1) < it.id) newest.set(key, it.id)
  }
  return items.map(it => {
    const { folder, session, week } = splitTitle(it.title)
    return { ...it, folder, session, week, isDuplicate: newest.get(it.title.trim().toLowerCase()) !== it.id }
  })
}

export type ListSort = 'recent' | 'title' | 'id' | 'exercises'

export type ListFilters = {
  search: string
  access: 'all' | 'exclusive' | 'free'
  visibility: 'all' | 'public' | 'private'
  exercises: 'all' | 'with' | 'empty'
  onlyDuplicates: boolean
  sort: ListSort
}

export const DEFAULT_LIST_FILTERS: ListFilters = {
  search: '',
  access: 'all',
  visibility: 'all',
  exercises: 'all',
  onlyDuplicates: false,
  sort: 'recent',
}

export function countActiveListFilters(f: ListFilters): number {
  return (
    (f.search.trim() ? 1 : 0) + (f.access !== 'all' ? 1 : 0) + (f.visibility !== 'all' ? 1 : 0) +
    (f.exercises !== 'all' ? 1 : 0) + (f.onlyDuplicates ? 1 : 0)
  )
}

const time = (s?: string) => (s ? Date.parse(s) || 0 : 0)

export function sortItems<T extends DecoratedItem>(items: T[], sort: ListSort): T[] {
  const copy = [...items]
  switch (sort) {
    case 'title': return copy.sort((a, b) => a.title.localeCompare(b.title, 'es', { numeric: true, sensitivity: 'base' }))
    case 'id': return copy.sort((a, b) => b.id - a.id)
    case 'exercises': return copy.sort((a, b) => (b.exercise_count ?? 0) - (a.exercise_count ?? 0) || b.id - a.id)
    default: return copy.sort((a, b) => time(b.created_at) - time(a.created_at) || b.id - a.id)
  }
}

export function filterItems(items: DecoratedItem[], f: ListFilters): DecoratedItem[] {
  const q = f.search.trim().toLowerCase()
  const out = items.filter(it => {
    if (q && !`${it.title} ${it.description ?? ''} ${it.id}`.toLowerCase().includes(q)) return false
    if (f.access === 'exclusive' && !it.is_exclusive) return false
    if (f.access === 'free' && it.is_exclusive) return false
    if (f.visibility === 'public' && !it.is_public) return false
    if (f.visibility === 'private' && it.is_public) return false
    if (f.exercises === 'with' && !(it.exercise_count && it.exercise_count > 0)) return false
    if (f.exercises === 'empty' && it.exercise_count && it.exercise_count > 0) return false
    if (f.onlyDuplicates && !it.isDuplicate) return false
    return true
  })
  return sortItems(out, f.sort)
}

export type Folder = {
  key: string
  /** null = plantillas sueltas (sin patrón "Programa · Sesión"). */
  name: string | null
  items: DecoratedItem[]
  weeks: number[]
  duplicates: number
  distinctTitles: number
  latest: number
}

/** Carpetas por programa, la más reciente primero y las sueltas al final. */
export function groupIntoFolders(items: DecoratedItem[]): Folder[] {
  const map = new Map<string, Folder>()
  for (const it of items) {
    const key = it.folder ?? '__loose__'
    let folder = map.get(key)
    if (!folder) {
      folder = { key, name: it.folder, items: [], weeks: [], duplicates: 0, distinctTitles: 0, latest: 0 }
      map.set(key, folder)
    }
    folder.items.push(it)
    if (it.isDuplicate) folder.duplicates++
    folder.latest = Math.max(folder.latest, time(it.created_at) || it.id)
  }
  const folders = [...map.values()]
  for (const f of folders) {
    f.weeks = [...new Set(f.items.map(i => i.week).filter((w): w is number => w != null))].sort((a, b) => a - b)
    f.distinctTitles = new Set(f.items.map(i => i.title.trim().toLowerCase())).size
  }
  return folders.sort((a, b) => {
    if (a.name === null) return 1
    if (b.name === null) return -1
    return b.latest - a.latest
  })
}

/** Dentro de una carpeta: agrupa por semana (las sin semana al final), ordenadas por sesión. */
export function groupByWeek(items: DecoratedItem[]): { week: number | null; items: DecoratedItem[] }[] {
  const map = new Map<number | null, DecoratedItem[]>()
  for (const it of items) {
    const list = map.get(it.week) ?? []
    list.push(it)
    map.set(it.week, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a - b))
    .map(([week, list]) => ({
      week,
      items: list.sort((a, b) => a.session.localeCompare(b.session, 'es', { numeric: true }) || b.id - a.id),
    }))
}
