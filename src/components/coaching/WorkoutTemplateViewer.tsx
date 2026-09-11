
import { useState, useRef, useMemo, useEffect } from 'react'
import { api } from '@/lib/api'
import {
  LayoutListIcon,
  LayoutGridIcon,
  SearchIcon,
  PlusIcon,
  GripVerticalIcon,
  MoreVerticalIcon,
  MessageSquareTextIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TrashIcon,
  LayersIcon,
  ClockIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type WorkoutViewerExercise = {
  id: number
  exercise_id?: number
  title: string
  exercise_image?: string | null
  video_url?: string | null
  prescribed?: Record<string, string | number | null | undefined> | null
  notes?: string | null
  client_note?: string | null
  enabled_metrics?: string[] | null
  logged?: boolean
  sets?: any[]
  prs_this_session?: number
  exercise_volume?: number
  // Ultima sesion real del cliente para este ejercicio (solo presente si
  // el detalle se pidio con client_id) - referencia para ajustar la carga
  // prescrita sin salir a Historial de ejercicios/Entrenamientos completados.
  last_performance?: { sets: Record<string, any>[] } | null
}

export type WorkoutViewerBlock = {
  id: number
  title: string | null
  instructions?: string | null
  exercises: WorkoutViewerExercise[]
}

export type WorkoutTemplateViewerProps = {
  title: string
  description?: string | null
  thumbnail?: string | null
  blocks: WorkoutViewerBlock[]
  mode?: 'routine' | 'library'
  readOnly?: boolean
  badge?: React.ReactNode
  headerExtras?: React.ReactNode
  availableExercises?: WorkoutViewerExercise[]
  availableExercisesLoading?: boolean
  onAddBlock?: (title: string) => void
  onRenameBlock?: (blockId: number, title: string) => void
  onRemoveBlock?: (blockId: number) => void
  onUpdateBlockInstructions?: (blockId: number, value: string) => void
  onAddExercise?: (blockId: number, exercise: WorkoutViewerExercise) => void
  onRemoveExercise?: (blockId: number, exerciseId: number) => void
  onUpdateExerciseField?: (exercise: WorkoutViewerExercise, blockId: number, field: string, value: string) => void
  onUpdateExerciseMetrics?: (exercise: WorkoutViewerExercise, blockId: number, metrics: string[]) => void
  onExerciseNotes?: (exercise: WorkoutViewerExercise, blockId: number) => void
  onSearchExercises?: (query: string) => void
  prescribedReadOnly?: boolean
  metricsReadOnly?: boolean
}

const DEFAULT_THUMBNAIL = 'https://app.hubfit.com/media/workout-thumbnails/default.jpg'

// El valor de cada opcion es directamente la clave real del catalogo
// (metrics_catalog / GET metric-list) - la misma que usan enabled_metrics
// y prescribed en el backend y en la app movil. No existe una tabla de
// mapeo aparte: la clave de metrica ES la clave de prescribed.
const FALLBACK_METRIC_OPTIONS = [
  { value: '', label: '(Opcional)' },
  { value: 'reps', label: 'Repeticiones' },
  { value: 'carga', label: 'Carga' },
  { value: 'descanso', label: 'Descanso' },
  { value: 'tiempo', label: 'Tiempo' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'rpe', label: 'RPE' },
  { value: 'rir', label: 'RIR' },
]

type MetricOption = { value: string; label: string }

let metricOptionsCache: MetricOption[] | null = null
let metricOptionsPromise: Promise<MetricOption[]> | null = null

/** Catalogo real de metricas (metrics_catalog), cacheado en memoria - misma fuente que usa la app. */
function getMetricOptions(): Promise<MetricOption[]> {
  if (metricOptionsCache) return Promise.resolve(metricOptionsCache)
  if (!metricOptionsPromise) {
    metricOptionsPromise = api
      .get('/admin/metric-list')
      .then((res: any) => {
        const items = res.data || res || []
        const options: MetricOption[] = [
          { value: '', label: '(Opcional)' },
          ...items
            .filter((m: any) => m.key !== 'series')
            .map((m: any) => ({ value: m.key, label: m.label })),
        ]
        metricOptionsCache = options
        return options
      })
      .catch(() => {
        metricOptionsPromise = null
        return FALLBACK_METRIC_OPTIONS
      })
  }
  return metricOptionsPromise
}

/** "Última vez": serie a serie, lo que el cliente realmente uso - referencia para ajustar la carga prescrita. */
function formatLastPerformance(lastPerformance: WorkoutViewerExercise['last_performance']): string | null {
  const sets = lastPerformance?.sets
  if (!sets || sets.length === 0) return null
  return sets.map((s, i) => {
    const parts: string[] = []
    if (s.carga != null && s.carga !== '') parts.push(`${s.carga}kg`)
    if (s.reps != null && s.reps !== '') parts.push(`${s.reps}reps`)
    return parts.length > 0 ? `S${i + 1}: ${parts.join('×')}` : `S${i + 1}`
  }).join('  ·  ')
}

function ExerciseThumbnail({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-muted shrink-0', className)}>
      <img src={src} alt={alt} className='size-full object-cover' />
    </div>
  )
}

function MetricSelector({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string
  options: MetricOption[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className='h-7 w-full rounded-md border border-input bg-background px-1.5 text-center text-[11px] focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60'
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

function PrescribedEditor({
  exercise,
  readOnly,
  metricsReadOnly,
  onFieldChange,
  onMetricsChange,
}: {
  exercise: WorkoutViewerExercise
  readOnly?: boolean
  metricsReadOnly?: boolean
  onFieldChange?: (field: string, value: string) => void
  onMetricsChange?: (metrics: string[]) => void
}) {
  const [metricOptions, setMetricOptions] = useState<MetricOption[]>(FALLBACK_METRIC_OPTIONS)
  // Valores "en vivo" mientras se escribe, separados del valor del prop -
  // antes los inputs de Series/metricas eran controlados (value=...) SIN
  // onChange, asi que el navegador no podia reflejar lo que se tecleaba:
  // cualquier re-render (con frecuencia disparado por otra cosa en la
  // pagina) devolvia el input al valor viejo del prop a mitad de escritura.
  // Se sigue guardando solo al salir del campo (onBlur), como antes.
  const [localValues, setLocalValues] = useState<Record<string, string>>({})

  useEffect(() => {
    getMetricOptions().then(setMetricOptions)
  }, [])

  useEffect(() => {
    setLocalValues({})
  }, [exercise.id])

  const getFieldValue = (key: string) => localValues[key] ?? (exercise.prescribed?.[key] ?? '')
  const handleFieldChange = (key: string, value: string) => setLocalValues(prev => ({ ...prev, [key]: value }))
  const handleFieldBlur = (key: string, value: string) => onFieldChange?.(key, value)

  const metrics = useMemo(() => {
    const base = exercise.enabled_metrics || []
    const arr = Array(5).fill('')
    base.forEach((m, i) => { if (i < 5) arr[i] = m })
    return arr
  }, [exercise.enabled_metrics])

  const handleMetricChange = (idx: number, value: string) => {
    const next = [...metrics]
    next[idx] = value
    // remove trailing empty strings but keep internal empties? normalize to first 5
    onMetricsChange?.(next)
  }

  const lastPerformanceText = formatLastPerformance(exercise.last_performance)

  return (
    <div className='overflow-x-auto pb-1'>
      <div className='min-w-[520px]'>
        {lastPerformanceText && (
          <div className='flex items-center gap-1.5 mb-2 text-[11px] text-blue-600'>
            <ClockIcon className='size-3 shrink-0' />
            <span className='font-medium shrink-0'>Última vez:</span>
            <span className='truncate'>{lastPerformanceText}</span>
          </div>
        )}
        {/* Header row: Sets + 5 metric selectors */}
        <div className='grid grid-cols-6 gap-2 mb-1'>
          <div className='flex flex-col gap-1'>
            <span className='text-[10px] uppercase tracking-wider text-muted-foreground text-center'>Series</span>
          </div>
          {metrics.map((m, i) => (
            <div key={i} className='flex flex-col gap-1'>
              <MetricSelector
                value={m}
                options={metricOptions}
                onChange={v => handleMetricChange(i, v)}
                disabled={metricsReadOnly}
              />
            </div>
          ))}
        </div>

        {/* Values row */}
        <div className='grid grid-cols-6 gap-2'>
          <div className='flex flex-col gap-1'>
            {readOnly ? (
              <div className='h-7 flex items-center justify-center rounded-md border bg-muted/50 text-xs px-1'>
                {exercise.prescribed?.series ?? <span className='text-muted-foreground'>—</span>}
              </div>
            ) : (
              <Input
                className='h-7 text-center text-xs px-1'
                value={getFieldValue('series')}
                onChange={e => handleFieldChange('series', e.target.value)}
                onBlur={e => handleFieldBlur('series', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                placeholder='Series'
              />
            )}
          </div>
          {metrics.map((m, i) => {
            // La clave de metrica (m) ES la clave real de prescribed - sin mapeo indirecto.
            return (
              <div key={i} className='flex flex-col gap-1'>
                {!m || readOnly ? (
                  <div className={cn(
                    'h-7 flex items-center justify-center rounded-md border text-xs px-1',
                    m ? 'bg-muted/50' : 'bg-transparent border-transparent'
                  )}>
                    {m ? (exercise.prescribed?.[m] ?? <span className='text-muted-foreground'>—</span>) : ''}
                  </div>
                ) : (
                  <Input
                    className='h-7 text-center text-xs px-1'
                    value={getFieldValue(m)}
                    onChange={e => handleFieldChange(m, e.target.value)}
                    onBlur={e => handleFieldBlur(m, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    placeholder={metricOptions.find(o => o.value === m)?.label}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function WorkoutTemplateViewer({
  title,
  description,
  thumbnail,
  blocks,
  mode = 'routine',
  readOnly = false,
  badge,
  headerExtras,
  availableExercises = [],
  availableExercisesLoading = false,
  onAddBlock,
  onRenameBlock,
  onRemoveBlock,
  onUpdateBlockInstructions,
  onAddExercise,
  onRemoveExercise,
  onUpdateExerciseField,
  onUpdateExerciseMetrics,
  onExerciseNotes,
  onSearchExercises,
  prescribedReadOnly = false,
  metricsReadOnly,
}: WorkoutTemplateViewerProps) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [search, setSearch] = useState('')
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(() => new Set(blocks.map(b => b.id)))
  const [targetBlockId, setTargetBlockId] = useState<number | null>(null)
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [dragOverBlockId, setDragOverBlockId] = useState<number | null>(null)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [renamingBlockId, setRenamingBlockId] = useState<number | null>(null)
  const [confirmDeleteExercise, setConfirmDeleteExercise] = useState<{ blockId: number; exercise: WorkoutViewerExercise } | null>(null)
  const [confirmDeleteBlock, setConfirmDeleteBlock] = useState<WorkoutViewerBlock | null>(null)
  const [renamingBlockTitle, setRenamingBlockTitle] = useState('')
  const exerciseRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const allRoutineExercises = useMemo(() => blocks.flatMap(b => b.exercises), [blocks])

  const filteredBlocks = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return blocks
    return blocks
      .map(b => ({ ...b, exercises: b.exercises.filter(e => e.title.toLowerCase().includes(q)) }))
      .filter(b => b.exercises.length > 0)
  }, [blocks, search])



  useEffect(() => {
    setExpandedBlocks(prev => {
      const next = new Set(prev)
      blocks.forEach(b => next.add(b.id))
      return next
    })
  }, [blocks])

  useEffect(() => {
    if (mode !== 'library') return
    const timer = setTimeout(() => {
      onSearchExercises?.(exerciseSearch)
    }, 250)
    return () => clearTimeout(timer)
  }, [exerciseSearch, mode, onSearchExercises])

  const scrollToExercise = (id: number) => {
    const block = blocks.find(b => b.exercises.some(e => e.id === id))
    if (block && !expandedBlocks.has(block.id)) {
      setExpandedBlocks(prev => new Set(prev).add(block.id))
    }
    setTimeout(() => {
      exerciseRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const toggleBlock = (blockId: number) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }

  const handleAddSection = () => {
    if (!newSectionTitle.trim()) return
    onAddBlock?.(newSectionTitle.trim())
    setNewSectionTitle('')
    setAddSectionOpen(false)
  }

  const startRenamingBlock = (blockId: number, currentTitle: string | null) => {
    setRenamingBlockId(blockId)
    setRenamingBlockTitle(currentTitle || '')
  }

  const commitRenameBlock = (blockId: number) => {
    if (renamingBlockTitle.trim()) onRenameBlock?.(blockId, renamingBlockTitle.trim())
    setRenamingBlockId(null)
  }

  const handleLibraryExerciseClick = (ex: WorkoutViewerExercise) => {
    const target = targetBlockId ?? blocks[0]?.id
    if (target == null) {
      setAddSectionOpen(true)
      return
    }
    onAddExercise?.(target, ex)
  }

  const handleDragStart = (e: React.DragEvent, ex: WorkoutViewerExercise) => {
    e.dataTransfer.setData('application/json', JSON.stringify(ex))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleBlockDragOver = (e: React.DragEvent, blockId: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverBlockId(blockId)
  }

  const handleBlockDragLeave = () => {
    setDragOverBlockId(null)
  }

  const handleBlockDrop = (e: React.DragEvent, blockId: number) => {
    e.preventDefault()
    setDragOverBlockId(null)
    try {
      const ex: WorkoutViewerExercise = JSON.parse(e.dataTransfer.getData('application/json'))
      onAddExercise?.(blockId, ex)
    } catch {
      // dropped payload wasn't valid exercise JSON, ignore
    }
  }

  return (
    <div className='flex flex-col h-full min-h-0'>
      {/* Header bar */}
      <div className='flex flex-col gap-3 border-b pb-3 mb-3 shrink-0'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-3 min-w-0'>
            <ExerciseThumbnail src={thumbnail || DEFAULT_THUMBNAIL} alt={title} className='size-12 rounded-xl' />
            <div className='min-w-0'>
              <h3 className='text-base font-semibold truncate'>{title}</h3>
              <div className='flex items-center gap-2 text-xs text-muted-foreground flex-wrap'>
                <span>{allRoutineExercises.length} ejercicios</span>
                <span>• {blocks.length} bloques</span>
                {badge}
              </div>
            </div>
          </div>
          <div className='flex items-center gap-2 shrink-0 flex-wrap'>
            {headerExtras}
            <div className='flex items-center rounded-lg border p-0.5'>
              <button
                type='button'
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                  viewMode === 'list' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <LayoutListIcon className='size-3.5' /> Lista
              </button>
              <button
                type='button'
                onClick={() => setViewMode('grid')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                  viewMode === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <LayoutGridIcon className='size-3.5' /> Cuadrícula
              </button>
            </div>
            <div className='relative hidden sm:block'>
              <SearchIcon className='absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
              <Input
                placeholder={mode === 'library' ? 'Filtrar este entrenamiento' : 'Buscar ejercicio'}
                className='h-8 pl-7 text-xs w-44 lg:w-56'
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {!readOnly && (
              <Button size='sm' variant='outline' className='h-8 text-xs gap-1' onClick={() => setAddSectionOpen(true)}>
                <LayersIcon className='size-3.5' /> Añadir sección
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className='flex flex-1 gap-5 min-h-0 overflow-hidden'>
        {/* Left panel */}
        <div className='hidden lg:flex w-60 flex-col gap-2 border-r pr-4 overflow-y-auto shrink-0'>
          {mode === 'library' ? (
            <>
              <div className='flex items-center justify-between px-1'>
                <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>Biblioteca de ejercicios</span>
                <span className='text-[10px] text-muted-foreground'>{availableExercises.length}</span>
              </div>
              <div className='relative'>
                <SearchIcon className='absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
                <Input
                  placeholder='Buscar en la base de datos de ejercicios...'
                  className='h-8 pl-7 text-xs'
                  value={exerciseSearch}
                  onChange={e => setExerciseSearch(e.target.value)}
                />
              </div>
              {targetBlockId && (
                <div className='text-[10px] text-muted-foreground bg-muted/50 rounded-lg p-2'>
                  Añadiendo a: <span className='font-medium text-foreground'>{blocks.find(b => b.id === targetBlockId)?.title || 'Bloque'}</span>
                  <button onClick={() => setTargetBlockId(null)} className='ml-1 text-destructive hover:underline'>Limpiar</button>
                </div>
              )}
              {availableExercisesLoading ? (
                <p className='text-xs text-muted-foreground text-center py-4'>Cargando ejercicios...</p>
              ) : availableExercises.length === 0 ? (
                <p className='text-xs text-muted-foreground text-center py-4'>No se encontraron ejercicios.</p>
              ) : (
                availableExercises.map(ex => (
                  <button
                    key={ex.id}
                    type='button'
                    draggable
                    onDragStart={e => handleDragStart(e, ex)}
                    onClick={() => handleLibraryExerciseClick(ex)}
                    className='group flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors hover:bg-muted/50 hover:border-primary cursor-grab active:cursor-grabbing'
                  >
                    <ExerciseThumbnail src={ex.exercise_image || DEFAULT_THUMBNAIL} alt={ex.title} className='size-11 rounded-md' />
                    <span className='line-clamp-2 text-xs font-medium leading-tight flex-1'>{ex.title}</span>
                    <PlusIcon className='size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0' />
                  </button>
                ))
              )}
            </>
          ) : (
            allRoutineExercises.map(ex => (
              <button
                key={ex.id}
                type='button'
                onClick={() => scrollToExercise(ex.id)}
                className='group flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors hover:bg-muted/50'
              >
                <ExerciseThumbnail src={ex.exercise_image || DEFAULT_THUMBNAIL} alt={ex.title} className='size-11 rounded-md' />
                <span className='line-clamp-2 text-xs font-medium leading-tight flex-1'>{ex.title}</span>
                <GripVerticalIcon className='size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0' />
              </button>
            ))
          )}
        </div>

        {/* Right workout detail */}
        <div className='flex-1 overflow-y-auto pr-1 space-y-4 min-w-0'>
          {/* Workout description */}
          <div className='space-y-2'>
            <Textarea
              placeholder='Añade una descripción para este entrenamiento'
              className='min-h-[40px] text-xs resize-none'
              rows={1}
              readOnly
              value={description ?? ''}
            />
          </div>

          {/* Blocks */}
          {filteredBlocks.map(block => (
            <Collapsible
              key={block.id}
              open={expandedBlocks.has(block.id)}
              onOpenChange={() => toggleBlock(block.id)}
            >
              <div
                className={cn(
                  'rounded-2xl border overflow-hidden transition-colors',
                  dragOverBlockId === block.id && 'border-primary ring-1 ring-primary/30 bg-primary/5'
                )}
                onDragOver={e => !readOnly && handleBlockDragOver(e, block.id)}
                onDragLeave={handleBlockDragLeave}
                onDrop={e => !readOnly && handleBlockDrop(e, block.id)}
              >
                {/* El trigger de Radix/Base UI renderiza un <button> real - anidar
                    otros botones (Añadir, menu "...") dentro de el es HTML
                    invalido (button-en-button) y provocaba errores de
                    hidratacion y clics poco fiables. Solo el chevron+titulo
                    va dentro del trigger; las acciones son hermanas, fuera. */}
                <div className='flex w-full items-center justify-between gap-2 bg-muted/40 px-4 py-3 hover:bg-muted/60 transition-colors'>
                  <CollapsibleTrigger className='flex items-center gap-2 min-w-0 flex-1 text-left'>
                    {expandedBlocks.has(block.id) ? <ChevronDownIcon className='size-4 shrink-0' /> : <ChevronRightIcon className='size-4 shrink-0' />}
                    {renamingBlockId === block.id ? (
                      <input
                        className='h-6 w-48 rounded border bg-background px-1.5 text-sm font-semibold'
                        value={renamingBlockTitle}
                        onChange={e => setRenamingBlockTitle(e.target.value)}
                        onBlur={() => commitRenameBlock(block.id)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRenameBlock(block.id); if (e.key === 'Escape') setRenamingBlockId(null) }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span className='font-semibold text-sm truncate'>{block.title || `Bloque #${block.id}`}</span>
                    )}
                  </CollapsibleTrigger>
                  <div className='flex items-center gap-2 shrink-0'>
                    <span className='text-xs text-muted-foreground'>{block.exercises.length} ejercicios</span>
                    {!readOnly && mode === 'library' && (
                      <Button
                        variant={targetBlockId === block.id ? 'default' : 'ghost'}
                        size='sm'
                        className='h-6 text-[10px] px-2'
                        onClick={() => setTargetBlockId(block.id)}
                      >
                        <PlusIcon className='size-3 mr-1' /> Añadir
                      </Button>
                    )}
                    {!readOnly && (onRenameBlock || onRemoveBlock) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <span className='inline-flex size-6 items-center justify-center rounded-md hover:bg-muted'>
                            <MoreVerticalIcon className='size-3' />
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end' className='text-xs'>
                          {onRenameBlock && (
                            <DropdownMenuItem onClick={() => startRenamingBlock(block.id, block.title)}>Renombrar</DropdownMenuItem>
                          )}
                          {onRemoveBlock && (
                            <DropdownMenuItem onClick={() => setConfirmDeleteBlock(block)} className='text-destructive focus:text-destructive'>Eliminar bloque</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <CollapsibleContent>
                  <div className='p-3 space-y-3'>
                    {onUpdateBlockInstructions ? (
                      <Textarea
                        key={block.id}
                        className='min-h-[48px] text-xs resize-none'
                        rows={1}
                        defaultValue={block.instructions ?? ''}
                        onBlur={e => onUpdateBlockInstructions(block.id, e.target.value)}
                        placeholder='Instrucciones / notas del bloque (visibles para el cliente)...'
                      />
                    ) : block.instructions ? (
                      <p className='text-xs text-muted-foreground bg-muted/40 rounded-lg p-2'>{block.instructions}</p>
                    ) : null}
                    {block.exercises.length === 0 && (
                      <p className='text-xs text-muted-foreground text-center py-3'>No hay ejercicios todavía. {mode === 'library' && 'Haz clic en un ejercicio del panel izquierdo o arrástralo aquí.'}</p>
                    )}
                    {block.exercises.map(ex => (
                      <div
                        key={ex.id}
                        ref={el => { exerciseRefs.current[ex.id] = el }}
                        className='rounded-2xl border bg-card p-3 shadow-sm'
                      >
                        <div className='flex flex-col sm:flex-row items-start gap-3'>
                          <ExerciseThumbnail src={ex.exercise_image || DEFAULT_THUMBNAIL} alt={ex.title} className='size-16 sm:size-20 rounded-xl' />
                          <div className='flex-1 min-w-0 space-y-2.5 w-full'>
                            <div className='flex items-start justify-between gap-2'>
                              <div className='min-w-0'>
                                <p className='font-medium text-sm leading-tight'>{ex.title}</p>
                                {ex.notes && <p className='text-xs text-muted-foreground mt-1'>Note: {ex.notes}</p>}
                                {ex.client_note && <p className='text-xs text-blue-600 mt-1 flex items-start gap-1'><MessageSquareTextIcon className='size-3 shrink-0 mt-0.5' /> Feedback del cliente: {ex.client_note}</p>}
                              </div>
                              <div className='flex items-center gap-1 shrink-0'>
                                {onExerciseNotes && (
                                  <Button
                                    variant='ghost'
                                    size='icon'
                                    className='size-7'
                                    onClick={() => onExerciseNotes?.(ex, block.id)}
                                    title='Notas del coach'
                                  >
                                    <MessageSquareTextIcon className='size-3.5' />
                                  </Button>
                                )}
                                {!readOnly && (
                                  <Button
                                    variant='ghost'
                                    size='icon'
                                    className='size-7 text-destructive hover:text-destructive'
                                    onClick={() => setConfirmDeleteExercise({ blockId: block.id, exercise: ex })}
                                  >
                                    <TrashIcon className='size-3.5' />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {!readOnly && (
                              <Textarea
                                placeholder='Añadir una nota personalizada para este ejercicio'
                                className='min-h-[32px] text-xs resize-none'
                                rows={1}
                                value={ex.notes || ''}
                                onChange={() => {}}
                                onClick={() => onExerciseNotes?.(ex, block.id)}
                                readOnly
                              />
                            )}

                            <PrescribedEditor
                              exercise={ex}
                              readOnly={prescribedReadOnly}
                              metricsReadOnly={metricsReadOnly ?? readOnly}
                              onFieldChange={(field, value) => onUpdateExerciseField?.(ex, block.id, field, value)}
                              onMetricsChange={metrics => onUpdateExerciseMetrics?.(ex, block.id, metrics)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}

          {!readOnly && (
            <div className='flex items-center gap-2 pt-1'>
              <Button variant='outline' size='sm' className='h-8 text-xs gap-1' onClick={() => setAddSectionOpen(true)}>
                <LayersIcon className='size-3' /> Añadir sección
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Add Section Dialog */}
      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle className='text-sm'>Añadir sección</DialogTitle>
          </DialogHeader>
          <Input
            placeholder='Nombre de la sección'
            value={newSectionTitle}
            onChange={e => setNewSectionTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddSection() }}
            className='text-sm'
          />
          <div className='flex justify-end gap-2 mt-2'>
            <Button variant='outline' size='sm' onClick={() => setAddSectionOpen(false)}>Cancelar</Button>
            <Button size='sm' onClick={handleAddSection} disabled={!newSectionTitle.trim()}>Añadir sección</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado de ejercicio - antes se borraba al instante, sin avisar */}
      <Dialog open={!!confirmDeleteExercise} onOpenChange={open => { if (!open) setConfirmDeleteExercise(null) }}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle className='text-sm'>Eliminar ejercicio</DialogTitle>
          </DialogHeader>
          <p className='text-sm text-muted-foreground'>
            ¿Seguro que quieres eliminar <span className='font-medium text-foreground'>{confirmDeleteExercise?.exercise.title}</span> de este entrenamiento?
          </p>
          <div className='flex justify-end gap-2 mt-2'>
            <Button variant='outline' size='sm' onClick={() => setConfirmDeleteExercise(null)}>Cancelar</Button>
            <Button
              variant='destructive'
              size='sm'
              onClick={() => {
                if (confirmDeleteExercise) onRemoveExercise?.(confirmDeleteExercise.blockId, confirmDeleteExercise.exercise.id)
                setConfirmDeleteExercise(null)
              }}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado de bloque - elimina tambien todos sus ejercicios */}
      <Dialog open={!!confirmDeleteBlock} onOpenChange={open => { if (!open) setConfirmDeleteBlock(null) }}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle className='text-sm'>Eliminar bloque</DialogTitle>
          </DialogHeader>
          <p className='text-sm text-muted-foreground'>
            ¿Seguro que quieres eliminar <span className='font-medium text-foreground'>{confirmDeleteBlock?.title || `Bloque #${confirmDeleteBlock?.id}`}</span>
            {confirmDeleteBlock && confirmDeleteBlock.exercises.length > 0 ? ` y sus ${confirmDeleteBlock.exercises.length} ejercicios` : ''}?
          </p>
          <div className='flex justify-end gap-2 mt-2'>
            <Button variant='outline' size='sm' onClick={() => setConfirmDeleteBlock(null)}>Cancelar</Button>
            <Button
              variant='destructive'
              size='sm'
              onClick={() => {
                if (confirmDeleteBlock) onRemoveBlock?.(confirmDeleteBlock.id)
                setConfirmDeleteBlock(null)
              }}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
