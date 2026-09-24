import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIST_FILTERS,
  decorate,
  filterItems,
  groupByWeek,
  groupIntoFolders,
  splitTitle,
  type TemplateListItem,
} from './workoutTemplateGroups'

const t = (id: number, title: string, over: Partial<TemplateListItem> = {}): TemplateListItem => ({
  id, title, description: null, exercise_count: 4, is_exclusive: false, is_public: false,
  created_at: `2026-09-${String(10 + (id % 20)).padStart(2, '0')}T10:00:00Z`, ...over,
})

describe('splitTitle', () => {
  it('separa programa, sesión y semana', () => {
    expect(splitTitle('Macrociclo 2 - Mesociclo 1 · Empuje (S3)')).toEqual({
      folder: 'Macrociclo 2 - Mesociclo 1', session: 'Empuje (S3)', week: 3,
    })
  })
  it('usa el último " · " cuando el nombre del programa ya contiene uno', () => {
    expect(splitTitle('Be Stronger — Macrociclo 2 · Mesociclo 1 (M1) · Pierna (S1)')).toEqual({
      folder: 'Be Stronger — Macrociclo 2 · Mesociclo 1 (M1)', session: 'Pierna (S1)', week: 1,
    })
  })
  it('títulos sin patrón quedan sueltos y sin semana', () => {
    expect(splitTitle('test')).toEqual({ folder: null, session: 'test', week: null })
  })
})

describe('decorate / duplicados', () => {
  const items = [t(700, 'P · Empuje (S3)'), t(729, 'P · Empuje (S3)'), t(640, 'P · Tracción (S3)')]
  it('solo la de id mayor con el mismo título es la vigente', () => {
    const d = decorate(items)
    expect(d.find(i => i.id === 700)!.isDuplicate).toBe(true)
    expect(d.find(i => i.id === 729)!.isDuplicate).toBe(false)
    expect(d.find(i => i.id === 640)!.isDuplicate).toBe(false)
  })
})

describe('filtros', () => {
  const items = decorate([
    t(1, 'P · A (S1)', { is_exclusive: true, exercise_count: 0 }),
    t(2, 'P · B (S1)', { is_public: true, description: 'fuerza' }),
    t(3, 'P · B (S1)'),
    t(4, 'suelta'),
  ])
  it('búsqueda por título, descripción o id', () => {
    expect(filterItems(items, { ...DEFAULT_LIST_FILTERS, search: 'fuerza' }).map(i => i.id)).toEqual([2])
    expect(filterItems(items, { ...DEFAULT_LIST_FILTERS, search: '4' }).map(i => i.id)).toEqual([4])
  })
  it('acceso, visibilidad, vacías y duplicadas', () => {
    expect(filterItems(items, { ...DEFAULT_LIST_FILTERS, access: 'exclusive' }).map(i => i.id)).toEqual([1])
    expect(filterItems(items, { ...DEFAULT_LIST_FILTERS, visibility: 'public' }).map(i => i.id)).toEqual([2])
    expect(filterItems(items, { ...DEFAULT_LIST_FILTERS, exercises: 'empty' }).map(i => i.id)).toEqual([1])
    expect(filterItems(items, { ...DEFAULT_LIST_FILTERS, onlyDuplicates: true }).map(i => i.id)).toEqual([2])
  })
})

describe('carpetas', () => {
  const items = decorate([
    t(1, 'A · X (S2)'), t(2, 'A · Y (S1)'), t(3, 'A · X (S1)'), t(4, 'B · Z (S1)'), t(5, 'suelta'),
  ])
  it('agrupa por programa, con las sueltas al final', () => {
    const folders = groupIntoFolders(items)
    expect(folders.map(f => f.name)).toEqual(expect.arrayContaining(['A', 'B', null]))
    expect(folders[folders.length - 1].name).toBeNull()
    const a = folders.find(f => f.name === 'A')!
    expect(a.items).toHaveLength(3)
    expect(a.weeks).toEqual([1, 2])
    expect(a.distinctTitles).toBe(3)
  })
  it('dentro de una carpeta ordena por semana y sesión', () => {
    const a = groupIntoFolders(items).find(f => f.name === 'A')!
    const weeks = groupByWeek(a.items)
    expect(weeks.map(w => w.week)).toEqual([1, 2])
    expect(weeks[0].items.map(i => i.session)).toEqual(['X (S1)', 'Y (S1)'])
  })
})
