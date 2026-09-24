import { useEffect, useMemo, useState } from 'react'
import { DumbbellIcon, SearchIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { fuzzyFilter } from '@/lib/textSearch'
import ExerciseFiltersPanel from '@/views/fitness/ExerciseFiltersPanel'
import { EMPTY_FILTERS, applyExerciseFilters, type ExerciseFilterState, type ExerciseFilterable } from '@/views/fitness/exerciseFilters'

export type PickedExercise = { id: number; title: string }

type ExerciseItem = ExerciseFilterable & {
  equipment_title?: string | null
  bodypart_names?: string | null
  level_title?: string | null
}
type Option = { id: number; title: string }

// Mismas categorías que el catálogo de ejercicios (/exercises).
const CATEGORIES = [
  { value: 'fuerza', label: 'Fuerza' },
  { value: 'movilidad', label: 'Movilidad' },
  { value: 'pliometria', label: 'Pliometría' },
  { value: 'metabolico', label: 'Metabólico' },
  { value: 'cardio', label: 'Cardio' },
]

const PAGE = 48
const asList = (res: any): any[] => res?.data?.data ?? res?.data ?? []

/**
 * Buscador de ejercicios con foto y los mismos filtros que el catálogo (grupo muscular, equipamiento,
 * nivel, categoría, multimedia...). Por defecto solo ejercicios activos.
 */
export default function ExercisePickerPanel({ onPick }: { onPick: (exercise: PickedExercise) => void }) {
  const [items, setItems] = useState<ExerciseItem[] | null>(null)
  const [bodyParts, setBodyParts] = useState<Option[]>([])
  const [equipments, setEquipments] = useState<Option[]>([])
  const [levels, setLevels] = useState<Option[]>([])
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<ExerciseFilterState>({ ...EMPTY_FILTERS, status: ['active'] })
  const [visible, setVisible] = useState(PAGE)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      api.get('/admin/exercises?per_page=-1'),
      api.get('/admin/body-parts?per_page=-1'),
      api.get('/admin/equipment?per_page=-1'),
      api.get('/admin/levels?per_page=-1'),
    ]).then(([ex, bp, eq, lv]) => {
      if (!alive) return
      setItems(ex.status === 'fulfilled' ? asList(ex.value) : [])
      if (bp.status === 'fulfilled') setBodyParts(asList(bp.value))
      if (eq.status === 'fulfilled') setEquipments(asList(eq.value))
      if (lv.status === 'fulfilled') setLevels(asList(lv.value))
    })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const byFilters = applyExerciseFilters(items ?? [], filters)
    return fuzzyFilter(byFilters, query, e => e.title, { rank: true })
  }, [items, filters, query])

  useEffect(() => setVisible(PAGE), [query, filters])

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='relative'>
        <SearchIcon className='absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input autoFocus className='pl-9' placeholder='Buscar ejercicio...' value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className='min-h-0 flex-1 space-y-3 overflow-y-auto pr-1'>
        {items && (
          <ExerciseFiltersPanel
            items={items}
            filters={filters}
            onChange={setFilters}
            bodyParts={bodyParts}
            equipments={equipments}
            levels={levels}
            categories={CATEGORIES}
            resultCount={filtered.length}
          />
        )}

        {!items ? (
          <p className='px-3 py-8 text-center text-sm text-muted-foreground'>Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className='px-3 py-8 text-center text-sm text-muted-foreground'>Ningún ejercicio cumple la búsqueda y los filtros.</p>
        ) : (
          <>
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'>
              {filtered.slice(0, visible).map(e => (
                <button
                  key={e.id}
                  type='button'
                  onClick={() => onPick({ id: e.id, title: e.title })}
                  className='group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-primary'
                >
                  <div className='aspect-[4/3] w-full overflow-hidden bg-muted'>
                    {e.exercise_image ? (
                      <img src={e.exercise_image} alt='' loading='lazy' decoding='async' className='size-full object-cover' />
                    ) : (
                      <div className='flex size-full items-center justify-center text-muted-foreground/40'><DumbbellIcon className='size-8' /></div>
                    )}
                  </div>
                  <div className='space-y-1 p-2'>
                    <p className='line-clamp-2 text-xs font-medium leading-tight'>{e.title}</p>
                    <div className='flex flex-wrap gap-1'>
                      {e.equipment_title && <Badge variant='outline' className='h-4 px-1 text-[9px]'>{e.equipment_title}</Badge>}
                      {e.level_title && <Badge variant='outline' className='h-4 px-1 text-[9px]'>{e.level_title}</Badge>}
                    </div>
                    {e.bodypart_names && <p className='truncate text-[10px] text-muted-foreground'>{e.bodypart_names}</p>}
                  </div>
                </button>
              ))}
            </div>
            {filtered.length > visible && (
              <div className='flex justify-center'>
                <Button variant='outline' size='sm' onClick={() => setVisible(v => v + PAGE)}>
                  Ver más ({filtered.length - visible} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
