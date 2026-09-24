import { useMemo, useState, type ReactNode } from 'react'
import { FilterIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  BASED_LABELS,
  EMPTY_FILTERS,
  HAS,
  MISSING,
  MISSING_LABELS,
  RECORD_TYPE_LABELS,
  STATUS_LABELS,
  bodyPartIdsOf,
  countActiveFilters,
  countWhere,
  isPremium,
  toggleIn,
  type ExerciseFilterState,
  type ExerciseFilterable,
  type ExerciseSort,
  type MissingField,
  type TriState,
} from './exerciseFilters'

type Option = { id: number; title: string }

type Props = {
  items: ExerciseFilterable[]
  filters: ExerciseFilterState
  onChange: (next: ExerciseFilterState) => void
  bodyParts: Option[]
  equipments: Option[]
  levels: Option[]
  categories: { value: string; label: string }[]
  resultCount: number
}

const SORT_LABELS: Record<ExerciseSort, string> = {
  title: 'Título (A-Z)',
  recent: 'Más recientes',
  updated: 'Actualizados recientemente',
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div>
        <h4 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{title}</h4>
        {hint && <p className='text-[11px] text-muted-foreground/80'>{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='space-y-1.5'>
      <p className='text-xs font-medium'>{label}</p>
      <div className='flex flex-wrap gap-1.5'>{children}</div>
    </div>
  )
}

function Chip({ active, count, onClick, children }: { active: boolean; count?: number; onClick: () => void; children: ReactNode }) {
  const empty = count === 0 && !active
  return (
    <button
      type='button'
      disabled={empty}
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
        empty ? 'cursor-not-allowed opacity-40 hover:bg-background' : '',
      ].join(' ')}
    >
      {children}
      {count != null && <span className={active ? 'opacity-80' : 'text-muted-foreground'}>{count}</span>}
    </button>
  )
}

const TRI_LABELS: { value: TriState; label: string }[] = [
  { value: 'any', label: 'Todos' },
  { value: 'yes', label: 'Con' },
  { value: 'no', label: 'Sin' },
]

function TriRow({ label, value, onChange, withCount, withoutCount }: {
  label: string
  value: TriState
  onChange: (v: TriState) => void
  withCount: number
  withoutCount: number
}) {
  return (
    <Row label={label}>
      {TRI_LABELS.map(o => (
        <Chip
          key={o.value}
          active={value === o.value && o.value !== 'any'}
          count={o.value === 'yes' ? withCount : o.value === 'no' ? withoutCount : undefined}
          onClick={() => onChange(value === o.value ? 'any' : o.value)}
        >
          {o.label}
        </Chip>
      ))}
    </Row>
  )
}

export default function ExerciseFiltersPanel({ items, filters, onChange, bodyParts, equipments, levels, categories, resultCount }: Props) {
  const [open, setOpen] = useState(false)
  const active = countActiveFilters(filters)
  const set = (patch: Partial<ExerciseFilterState>) => onChange({ ...filters, ...patch })

  // Contadores por opción (sobre la lista completa, no la ya filtrada, para
  // que se vea cuántos ejercicios existen de cada tipo).
  const counts = useMemo(() => {
    const bodyPart = new Map<number, number>()
    const equipment = new Map<number, number>()
    const level = new Map<number, number>()
    const category = new Map<string, number>()
    const based = new Map<string, number>()
    const record = new Map<string, number>()
    const status = new Map<string, number>()
    const inc = <K,>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1)
    for (const e of items) {
      bodyPartIdsOf(e).forEach(id => inc(bodyPart, id))
      if (e.equipment_id != null) inc(equipment, e.equipment_id)
      if (e.level_id != null) inc(level, e.level_id)
      if (e.exercise_type) inc(category, e.exercise_type)
      if (e.based) inc(based, e.based)
      if (e.type) inc(record, e.type)
      inc(status, e.status ?? 'active')
    }
    return {
      bodyPart, equipment, level, category, based, record, status,
      premium: countWhere(items, isPremium),
      image: countWhere(items, HAS.image),
      video: countWhere(items, HAS.video),
      instruction: countWhere(items, HAS.instruction),
      tips: countWhere(items, HAS.tips),
      tempo: countWhere(items, HAS.tempo),
      missing: (Object.keys(MISSING) as MissingField[]).reduce(
        (acc, k) => ({ ...acc, [k]: countWhere(items, MISSING[k]) }),
        {} as Record<MissingField, number>,
      ),
    }
  }, [items])

  const total = items.length

  return (
    <div className='mb-4 space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Button variant={active ? 'default' : 'outline'} size='sm' onClick={() => setOpen(o => !o)}>
          <FilterIcon className='mr-1.5 size-3.5' />
          Filtros{active ? ` (${active})` : ''}
        </Button>
        <Select value={filters.sort} onValueChange={v => set({ sort: (v ?? 'title') as ExerciseSort })}>
          <SelectTrigger className='h-8 w-[220px] text-xs'>
            <SelectValue placeholder='Ordenar por' />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as ExerciseSort[]).map(k => (
              <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {active > 0 && (
          <Button variant='ghost' size='sm' onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })}>
            <XIcon className='mr-1 size-3.5' /> Limpiar filtros
          </Button>
        )}
        <span className='ml-auto text-xs text-muted-foreground'>
          {resultCount === total ? `${total} ejercicios` : `${resultCount} de ${total} ejercicios`}
        </span>
      </div>

      {open && (
        <div className='grid gap-3 lg:grid-cols-2'>
          <Group title='Clasificación' hint='Qué es el ejercicio: músculo, material, dificultad y categoría.'>
            <Row label='Grupo muscular'>
              {bodyParts.map(b => (
                <Chip key={b.id} active={filters.bodyParts.includes(b.id)} count={counts.bodyPart.get(b.id) ?? 0}
                  onClick={() => set({ bodyParts: toggleIn(filters.bodyParts, b.id) })}>{b.title}</Chip>
              ))}
            </Row>
            <Row label='Equipamiento'>
              {equipments.map(eq => (
                <Chip key={eq.id} active={filters.equipment.includes(eq.id)} count={counts.equipment.get(eq.id) ?? 0}
                  onClick={() => set({ equipment: toggleIn(filters.equipment, eq.id) })}>{eq.title}</Chip>
              ))}
            </Row>
            <Row label='Nivel'>
              {levels.map(l => (
                <Chip key={l.id} active={filters.levels.includes(l.id)} count={counts.level.get(l.id) ?? 0}
                  onClick={() => set({ levels: toggleIn(filters.levels, l.id) })}>{l.title}</Chip>
              ))}
            </Row>
            <Row label='Categoría de entrenamiento'>
              {categories.map(c => (
                <Chip key={c.value} active={filters.categories.includes(c.value)} count={counts.category.get(c.value) ?? 0}
                  onClick={() => set({ categories: toggleIn(filters.categories, c.value) })}>{c.label}</Chip>
              ))}
            </Row>
          </Group>

          <div className='space-y-3'>
            <Group title='Registro y medición' hint='Cómo se registra la serie en la app.'>
              <Row label='Se mide por'>
                {Object.entries(BASED_LABELS).map(([v, label]) => (
                  <Chip key={v} active={filters.based.includes(v)} count={counts.based.get(v) ?? 0}
                    onClick={() => set({ based: toggleIn(filters.based, v) })}>{label}</Chip>
                ))}
              </Row>
              <Row label='Tipo de registro'>
                {Object.entries(RECORD_TYPE_LABELS).map(([v, label]) => (
                  <Chip key={v} active={filters.recordType.includes(v)} count={counts.record.get(v) ?? 0}
                    onClick={() => set({ recordType: toggleIn(filters.recordType, v) })}>{label}</Chip>
                ))}
              </Row>
              <TriRow label='Tempo (segundos por repetición)' value={filters.hasTempo}
                onChange={v => set({ hasTempo: v })} withCount={counts.tempo} withoutCount={total - counts.tempo} />
            </Group>

            <Group title='Acceso y estado'>
              <Row label='Plan'>
                <Chip active={filters.premium === 'free'} count={total - counts.premium}
                  onClick={() => set({ premium: filters.premium === 'free' ? 'all' : 'free' })}>Gratuito</Chip>
                <Chip active={filters.premium === 'premium'} count={counts.premium}
                  onClick={() => set({ premium: filters.premium === 'premium' ? 'all' : 'premium' })}>Premium</Chip>
              </Row>
              <Row label='Estado'>
                {Object.entries(STATUS_LABELS).map(([v, label]) => (
                  <Chip key={v} active={filters.status.includes(v)} count={counts.status.get(v) ?? 0}
                    onClick={() => set({ status: toggleIn(filters.status, v) })}>{label}</Chip>
                ))}
              </Row>
            </Group>
          </div>

          <Group title='Contenido y multimedia' hint='Qué material tiene cargado cada ejercicio.'>
            <TriRow label='Imagen' value={filters.hasImage} onChange={v => set({ hasImage: v })}
              withCount={counts.image} withoutCount={total - counts.image} />
            <TriRow label='Vídeo' value={filters.hasVideo} onChange={v => set({ hasVideo: v })}
              withCount={counts.video} withoutCount={total - counts.video} />
            <TriRow label='Instrucciones' value={filters.hasInstruction} onChange={v => set({ hasInstruction: v })}
              withCount={counts.instruction} withoutCount={total - counts.instruction} />
            <TriRow label='Consejos' value={filters.hasTips} onChange={v => set({ hasTips: v })}
              withCount={counts.tips} withoutCount={total - counts.tips} />
          </Group>

          <Group title='Datos incompletos' hint='Atajos para detectar qué ejercicios necesitan revisión (muestra los que les falta alguno de los marcados).'>
            <div className='flex flex-wrap gap-1.5'>
              {(Object.keys(MISSING_LABELS) as MissingField[]).map(k => (
                <Chip key={k} active={filters.missing.includes(k)} count={counts.missing[k]}
                  onClick={() => set({ missing: toggleIn(filters.missing, k) })}>{MISSING_LABELS[k]}</Chip>
              ))}
            </div>
          </Group>
        </div>
      )}
    </div>
  )
}
