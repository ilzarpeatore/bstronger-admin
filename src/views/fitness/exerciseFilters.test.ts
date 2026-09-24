import { describe, expect, it } from 'vitest'
import {
  EMPTY_FILTERS,
  applyExerciseFilters,
  bodyPartIdsOf,
  countActiveFilters,
  toggleIn,
  type ExerciseFilterable,
  type ExerciseFilterState,
} from './exerciseFilters'

const base: ExerciseFilterable = {
  id: 1, title: 'Sentadilla', exercise_image: 'https://x/img.jpg', level_id: 1, equipment_id: 2,
  bodypart_ids: [3, 4], type: 'sets', exercise_type: 'fuerza', based: 'reps', seconds_per_rep: null,
  is_premium: 0, status: 'active', instruction: 'Baja', tips: null, video_url: null, video_type: null,
}
const make = (over: Partial<ExerciseFilterable>): ExerciseFilterable => ({ ...base, ...over })
const f = (over: Partial<ExerciseFilterState>): ExerciseFilterState => ({ ...EMPTY_FILTERS, ...over })

describe('exerciseFilters', () => {
  const items = [
    make({ id: 1, title: 'Sentadilla' }),
    make({ id: 2, title: 'Press banca', bodypart_ids: [5], equipment_id: 9, level_id: 2, exercise_image: null }),
    make({ id: 3, title: 'Plancha', bodypart_ids: null, equipment_id: null, exercise_type: null, based: 'time', type: 'duration', is_premium: 1 }),
    make({ id: 4, title: 'Zancada', bodypart_ids: 3, tips: 'Espalda recta', video_url: 'https://y/v' }),
  ]

  it('sin filtros devuelve todo, ordenado por título', () => {
    expect(applyExerciseFilters(items, EMPTY_FILTERS).map(e => e.title)).toEqual(['Plancha', 'Press banca', 'Sentadilla', 'Zancada'])
  })

  it('grupo muscular: cualquiera de los elegidos, y tolera el formato antiguo escalar', () => {
    expect(bodyPartIdsOf(items[3])).toEqual([3])
    expect(applyExerciseFilters(items, f({ bodyParts: [3] })).map(e => e.id).sort()).toEqual([1, 4])
    expect(applyExerciseFilters(items, f({ bodyParts: [3, 5] })).map(e => e.id).sort()).toEqual([1, 2, 4])
  })

  it('equipamiento y nivel excluyen los ejercicios sin ese dato', () => {
    expect(applyExerciseFilters(items, f({ equipment: [2] })).map(e => e.id).sort()).toEqual([1, 4])
    expect(applyExerciseFilters(items, f({ levels: [2] })).map(e => e.id)).toEqual([2])
  })

  it('registro: repeticiones / tiempo', () => {
    expect(applyExerciseFilters(items, f({ based: ['time'] })).map(e => e.id)).toEqual([3])
    expect(applyExerciseFilters(items, f({ recordType: ['duration'] })).map(e => e.id)).toEqual([3])
  })

  it('premium / gratuito', () => {
    expect(applyExerciseFilters(items, f({ premium: 'premium' })).map(e => e.id)).toEqual([3])
    expect(applyExerciseFilters(items, f({ premium: 'free' })).map(e => e.id).sort()).toEqual([1, 2, 4])
  })

  it('contenido: con/sin imagen, vídeo y consejos', () => {
    expect(applyExerciseFilters(items, f({ hasImage: 'no' })).map(e => e.id)).toEqual([2])
    expect(applyExerciseFilters(items, f({ hasVideo: 'yes' })).map(e => e.id)).toEqual([4])
    expect(applyExerciseFilters(items, f({ hasTips: 'yes' })).map(e => e.id)).toEqual([4])
  })

  it('datos incompletos se combinan con "o"', () => {
    expect(applyExerciseFilters(items, f({ missing: ['bodypart'] })).map(e => e.id)).toEqual([3])
    expect(applyExerciseFilters(items, f({ missing: ['bodypart', 'category'] })).map(e => e.id)).toEqual([3])
    expect(applyExerciseFilters(items, f({ missing: ['equipment', 'level'] })).map(e => e.id)).toEqual([3])
  })

  it('los filtros de distintos grupos se combinan con "y"', () => {
    expect(applyExerciseFilters(items, f({ bodyParts: [3], hasVideo: 'yes' })).map(e => e.id)).toEqual([4])
  })

  it('cuenta los filtros activos, sin contar el orden', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0)
    expect(countActiveFilters(f({ bodyParts: [1, 2], hasImage: 'no', premium: 'free', sort: 'recent' }))).toBe(4)
  })

  it('toggleIn añade y quita', () => {
    expect(toggleIn([1], 2)).toEqual([1, 2])
    expect(toggleIn([1, 2], 2)).toEqual([1])
  })
})
