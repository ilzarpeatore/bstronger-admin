import { fuzzyMatch } from '@/lib/textSearch'

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
  Gauge,
  Check,
  X,
  PencilIcon,
  RefreshCwIcon,
  PanelLeftIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Filtros de la Biblioteca de ejercicios (pedido explícito 2026-09-20) --
// bodypartId/equipmentId/levelId son ids reales (bodypart-list/equipment-list/
// level-list, ya existían para otras pantallas del panel), exerciseType es el
// enum fijo de Exercise::EXERCISE_TYPES en el backend (Bckbs).
export type ExerciseLibraryFilters = {
  bodypartId?: number
  equipmentId?: number
  levelId?: number
  exerciseType?: string
}

const EXERCISE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'fuerza', label: 'Fuerza' },
  { value: 'movilidad', label: 'Movilidad' },
  { value: 'pliometria', label: 'Pliometría' },
  { value: 'metabolico', label: 'Metabólico' },
  { value: 'cardio', label: 'Cardio' },
]

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
  // Motor de Auto-Regulación de Carga: null salvo que haya una sugerencia
  // pendiente de aprobación o aplicada recientemente para este ejercicio
  // (ver ClientCalendarController::getDayDetail / SessionDetailController::
  // getSessionDetail en el backend). Solo presente en sesiones de programa
  // asignado (no en plantillas sueltas del catálogo).
  load_suggestion?: {
    id: number
    status: 'pendiente' | 'aplicado'
    proposed_weight: number | null
    proposed_reps: number | null
    resolved_at: string | null
    rule_name: string | null
  } | null
  // AISLAMIENTO (auditoría 2026-09-18): true si el coach añadió este
  // ejercicio solo para este cliente (no vive en la plantilla compartida) --
  // solo presente cuando el detalle viene de una sesión de cliente
  // (SessionDetailController::getSessionDetail), nunca al editar una
  // plantilla del catálogo.
  is_addition?: boolean
}

export type WorkoutViewerBlock = {
  id: number
  title: string | null
  instructions?: string | null
  exercises: WorkoutViewerExercise[]
  // AISLAMIENTO (auditoría 2026-09-18): true si el bloque entero lo añadió
  // el coach solo para este cliente (client_block_overrides).
  is_addition?: boolean
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
  // BUG REAL (reportado 2026-09-20): no existía ninguna forma de renombrar
  // el workout/plantilla desde este visor (ni desde "Vista previa del
  // entrenamiento" en training-programs, ni desde el detalle de
  // /workout-templates/{id}) -- el título se pintaba como texto estático
  // (<h3>{title}</h3>), la única vía real era volver a la lista plana de
  // /workout-templates y usar el lápiz de esa fila. Mismo patrón de
  // click-para-renombrar que ya existe para los bloques (onRenameBlock).
  onUpdateTitle?: (title: string) => void
  onAddBlock?: (title: string) => void
  onRenameBlock?: (blockId: number, title: string) => void
  onRemoveBlock?: (blockId: number) => void
  // Guardar el bloque como plantilla de sección reutilizable (/section-templates).
  onSaveBlockAsSection?: (block: WorkoutViewerBlock) => void
  onUpdateBlockInstructions?: (blockId: number, value: string) => void
  onAddExercise?: (blockId: number, exercise: WorkoutViewerExercise) => void
  onRemoveExercise?: (blockId: number, exerciseId: number) => void
  onUpdateExerciseField?: (exercise: WorkoutViewerExercise, blockId: number, field: string, value: string) => void
  onUpdateExerciseMetrics?: (exercise: WorkoutViewerExercise, blockId: number, metrics: string[]) => void
  onExerciseNotes?: (exercise: WorkoutViewerExercise, blockId: number) => void
  // Sustituir ejercicio en sitio (misma fila de workout_template_exercises,
  // solo cambia exercise_id) -- conserva prescribed/enabled_metrics/notes,
  // a diferencia de "eliminar + añadir desde la biblioteca" que los perdía.
  onSubstituteExercise?: (exercise: WorkoutViewerExercise, blockId: number, newExercise: WorkoutViewerExercise) => void
  // Filtros de la Biblioteca de ejercicios (pedido explícito 2026-09-20) --
  // el segundo argumento siempre viaja, aunque esté vacío ({}), para que
  // quien implemente onSearchExercises no tenga que comprobar `undefined`.
  onSearchExercises?: (query: string, filters: ExerciseLibraryFilters) => void
  prescribedReadOnly?: boolean
  metricsReadOnly?: boolean
  // Motor de Auto-Regulación de Carga: acciones sobre exercise.load_suggestion
  // -- solo se pintan botones cuando el ejercicio trae una sugerencia
  // 'pendiente' (aprobar/editar/rechazar la mueve a 'aplicado'/'rechazado').
  onLoadSuggestionApprove?: (exercise: WorkoutViewerExercise) => void
  onLoadSuggestionEdit?: (exercise: WorkoutViewerExercise) => void
  onLoadSuggestionReject?: (exercise: WorkoutViewerExercise) => void
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

/** RIR/RPE es obligatorio (uno u otro) para todo ejercicio -- ya no es una metrica mas del selector generico, es una columna fija con este toggle de 2 opciones. */
function IntensityToggle({
  value,
  onChange,
  disabled,
}: {
  value: 'rir' | 'rpe'
  onChange: (value: 'rir' | 'rpe') => void
  disabled?: boolean
}) {
  return (
    <div className='flex h-7 w-full overflow-hidden rounded-md border border-input text-[10px] font-medium'>
      {(['rir', 'rpe'] as const).map(opt => (
        <button
          key={opt}
          type='button'
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={cn(
            'flex-1 uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            value === opt ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// Series/Reps/Carga/RIR-RPE tienen columna fija propia -- los selectores
// genericos restantes (descanso/tempo/duracion/...) no deben poder volver
// a ofrecerlas.
const FIXED_METRIC_KEYS = ['series', 'reps', 'carga', 'rir', 'rpe']
const OTHER_METRIC_SLOTS = 2

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

  const enabledMetrics = exercise.enabled_metrics || []
  // Si por lo que sea vinieran los dos a la vez (dato viejo), RIR gana --
  // es el default del backend. Si no hay ninguno (no debería pasar tras el
  // backfill), tambien cae a RIR.
  const intensityKey: 'rir' | 'rpe' = !enabledMetrics.includes('rir') && enabledMetrics.includes('rpe') ? 'rpe' : 'rir'

  const otherOptions = useMemo(
    () => metricOptions.filter(o => !FIXED_METRIC_KEYS.includes(o.value)),
    [metricOptions]
  )
  const otherMetrics = useMemo(() => {
    const rest = enabledMetrics.filter(m => !FIXED_METRIC_KEYS.includes(m))
    const arr = Array(OTHER_METRIC_SLOTS).fill('')
    rest.forEach((m, i) => { if (i < OTHER_METRIC_SLOTS) arr[i] = m })
    return arr
  }, [enabledMetrics])

  const buildMetrics = (intensity: string, others: string[]) => ['reps', 'carga', intensity, ...others]

  const handleIntensityChange = (value: 'rir' | 'rpe') => onMetricsChange?.(buildMetrics(value, otherMetrics))

  const handleOtherMetricChange = (idx: number, value: string) => {
    const next = [...otherMetrics]
    next[idx] = value
    onMetricsChange?.(buildMetrics(intensityKey, next))
  }

  const lastPerformanceText = formatLastPerformance(exercise.last_performance)

  return (
    <div>
      <div>
        {lastPerformanceText && (
          <div className='flex items-center gap-1.5 mb-2 text-[11px] text-blue-600'>
            <ClockIcon className='size-3 shrink-0' />
            <span className='font-medium shrink-0'>Última vez:</span>
            <span className='truncate'>{lastPerformanceText}</span>
          </div>
        )}
        {/* Header row: Series/Reps/Carga fijos, toggle RIR|RPE fijo, y hasta 2 selectores libres (descanso/tempo/...) -- 3 columnas en móvil (2 filas), 6 a partir de sm para que quepan en una sola fila */}
        <div className='grid grid-cols-3 sm:grid-cols-6 gap-2 mb-1'>
          <div className='flex flex-col gap-1'>
            <span className='text-[10px] uppercase tracking-wider text-muted-foreground text-center'>Series</span>
          </div>
          <div className='flex flex-col gap-1'>
            <span className='text-[10px] uppercase tracking-wider text-muted-foreground text-center'>Reps</span>
          </div>
          <div className='flex flex-col gap-1'>
            <span className='text-[10px] uppercase tracking-wider text-muted-foreground text-center'>Carga</span>
          </div>
          <div className='flex flex-col gap-1'>
            <IntensityToggle value={intensityKey} onChange={handleIntensityChange} disabled={metricsReadOnly} />
          </div>
          {otherMetrics.map((m, i) => (
            <div key={i} className='flex flex-col gap-1'>
              <MetricSelector
                value={m}
                options={otherOptions}
                onChange={v => handleOtherMetricChange(i, v)}
                disabled={metricsReadOnly}
              />
            </div>
          ))}
        </div>

        {/* Values row */}
        <div className='grid grid-cols-3 sm:grid-cols-6 gap-2'>
          {(['series', 'reps', 'carga'] as const).map(key => (
            <div key={key} className='flex flex-col gap-1'>
              {readOnly ? (
                <div className='h-7 flex items-center justify-center rounded-md border bg-muted/50 text-xs px-1'>
                  {exercise.prescribed?.[key] ?? <span className='text-muted-foreground'>—</span>}
                </div>
              ) : (
                <Input
                  className='h-7 text-center text-xs px-1'
                  value={getFieldValue(key)}
                  onChange={e => handleFieldChange(key, e.target.value)}
                  onBlur={e => handleFieldBlur(key, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  placeholder={key === 'series' ? 'Series' : key === 'reps' ? 'Reps' : 'Carga'}
                />
              )}
            </div>
          ))}
          <div className='flex flex-col gap-1'>
            {readOnly ? (
              <div className='h-7 flex items-center justify-center rounded-md border bg-muted/50 text-xs px-1'>
                {exercise.prescribed?.[intensityKey] ?? <span className='text-muted-foreground'>—</span>}
              </div>
            ) : (
              <Input
                className='h-7 text-center text-xs px-1'
                value={getFieldValue(intensityKey)}
                onChange={e => handleFieldChange(intensityKey, e.target.value)}
                onBlur={e => handleFieldBlur(intensityKey, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                placeholder={intensityKey.toUpperCase()}
              />
            )}
          </div>
          {otherMetrics.map((m, i) => {
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
                    placeholder={otherOptions.find(o => o.value === m)?.label}
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
  onUpdateTitle,
  onAddBlock,
  onRenameBlock,
  onRemoveBlock,
  onSaveBlockAsSection,
  onUpdateBlockInstructions,
  onAddExercise,
  onRemoveExercise,
  onUpdateExerciseField,
  onUpdateExerciseMetrics,
  onExerciseNotes,
  onSubstituteExercise,
  onSearchExercises,
  prescribedReadOnly = false,
  metricsReadOnly,
  onLoadSuggestionApprove,
  onLoadSuggestionEdit,
  onLoadSuggestionReject,
}: WorkoutTemplateViewerProps) {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false)
  const [renamingTitle, setRenamingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(title)
  useEffect(() => { setTitleDraft(title) }, [title])
  const commitRenameTitle = () => {
    const next = titleDraft.trim()
    if (next && next !== title) onUpdateTitle?.(next)
    else setTitleDraft(title)
    setRenamingTitle(false)
  }
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
  const [substituteTarget, setSubstituteTarget] = useState<{ blockId: number; exercise: WorkoutViewerExercise } | null>(null)
  const [substituteSearch, setSubstituteSearch] = useState('')
  const [renamingBlockTitle, setRenamingBlockTitle] = useState('')
  const [libraryFilters, setLibraryFilters] = useState<ExerciseLibraryFilters>({})
  const [libraryFiltersOpen, setLibraryFiltersOpen] = useState(false)
  const [bodyparts, setBodyparts] = useState<{ id: number; title: string }[]>([])
  const [equipmentOptions, setEquipmentOptions] = useState<{ id: number; title: string }[]>([])
  const [levelOptions, setLevelOptions] = useState<{ id: number; title: string }[]>([])
  const hasActiveLibraryFilters = Object.values(libraryFilters).some(v => v !== undefined && v !== '')
  const exerciseRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const allRoutineExercises = useMemo(() => blocks.flatMap(b => b.exercises), [blocks])

  const filteredBlocks = useMemo(() => {
    if (!search.trim()) return blocks
    return blocks
      .map(b => ({ ...b, exercises: b.exercises.filter(e => fuzzyMatch(search, e.title)) }))
      .filter(b => b.exercises.length > 0)
  }, [blocks, search])



  useEffect(() => {
    setExpandedBlocks(prev => {
      const next = new Set(prev)
      blocks.forEach(b => next.add(b.id))
      return next
    })
  }, [blocks])

  // Opciones de los filtros (pedido explícito 2026-09-20) -- listas de
  // referencia casi estáticas, se piden una sola vez al montar en modo
  // 'library'. bodypart-list/equipment-list/level-list ya existían para
  // otras pantallas del panel, no son endpoints nuevos.
  useEffect(() => {
    if (mode !== 'library') return
    api.get('/bodypart-list?per_page=-1').then(res => setBodyparts(res.data?.data || res.data || [])).catch(() => {})
    api.get('/equipment-list?per_page=-1').then(res => setEquipmentOptions(res.data?.data || res.data || [])).catch(() => {})
    api.get('/level-list?per_page=-1').then(res => setLevelOptions(res.data?.data || res.data || [])).catch(() => {})
  }, [mode])

  useEffect(() => {
    if (mode !== 'library') return
    const timer = setTimeout(() => {
      onSearchExercises?.(exerciseSearch, libraryFilters)
    }, 250)
    return () => clearTimeout(timer)
  }, [exerciseSearch, libraryFilters, mode, onSearchExercises])

  // Mismo catalogo (availableExercises) que la biblioteca del panel
  // izquierdo, con su propio termino de busqueda -- el dialogo de
  // sustitucion reusa el fetch existente en vez de duplicar la logica.
  // Sin filtros propios (fuera del alcance pedido) -- siempre manda {}.
  useEffect(() => {
    if (!substituteTarget) return
    const timer = setTimeout(() => {
      onSearchExercises?.(substituteSearch, {})
    }, 250)
    return () => clearTimeout(timer)
  }, [substituteSearch, substituteTarget, onSearchExercises])

  const openSubstitute = (blockId: number, exercise: WorkoutViewerExercise) => {
    setSubstituteSearch('')
    onSearchExercises?.('', {})
    setSubstituteTarget({ blockId, exercise })
  }

  const handleSubstitutePick = (newExercise: WorkoutViewerExercise) => {
    if (!substituteTarget) return
    onSubstituteExercise?.(substituteTarget.exercise, substituteTarget.blockId, newExercise)
    setSubstituteTarget(null)
  }

  const scrollToExercise = (id: number) => {
    const block = blocks.find(b => b.exercises.some(e => e.id === id))
    if (block && !expandedBlocks.has(block.id)) {
      setExpandedBlocks(prev => new Set(prev).add(block.id))
    }
    setMobileLibraryOpen(false)
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
    setMobileLibraryOpen(false)
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

  const libraryPanelContent = mode === 'library' ? (
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

      {/* Filtros de la Biblioteca de ejercicios (pedido explícito 2026-09-20) --
          músculo/equipo/nivel/tipo, combinables entre sí y con el buscador de
          texto. Colapsados por defecto para no ocupar espacio permanente en
          un panel ya estrecho. */}
      <button
        type='button'
        className='flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px] hover:bg-muted/50 transition-colors'
        onClick={() => setLibraryFiltersOpen(v => !v)}
      >
        <span className='flex items-center gap-1'>
          Filtros {hasActiveLibraryFilters && <span className='text-primary font-medium'>(activos)</span>}
        </span>
        <ChevronDownIcon className={cn('size-3 transition-transform', libraryFiltersOpen && 'rotate-180')} />
      </button>
      {libraryFiltersOpen && (
        <div className='grid grid-cols-2 gap-1.5 rounded-md border p-2'>
          <Select
            value={libraryFilters.bodypartId ? String(libraryFilters.bodypartId) : '__any__'}
            onValueChange={v => setLibraryFilters(f => ({ ...f, bodypartId: v === '__any__' ? undefined : Number(v) }))}
          >
            <SelectTrigger className='h-7 text-[11px]'><SelectValue placeholder='Músculo' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='__any__'>Cualquier músculo</SelectItem>
              {bodyparts.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={libraryFilters.equipmentId ? String(libraryFilters.equipmentId) : '__any__'}
            onValueChange={v => setLibraryFilters(f => ({ ...f, equipmentId: v === '__any__' ? undefined : Number(v) }))}
          >
            <SelectTrigger className='h-7 text-[11px]'><SelectValue placeholder='Equipo/Máquina' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='__any__'>Cualquier equipo</SelectItem>
              {equipmentOptions.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={libraryFilters.levelId ? String(libraryFilters.levelId) : '__any__'}
            onValueChange={v => setLibraryFilters(f => ({ ...f, levelId: v === '__any__' ? undefined : Number(v) }))}
          >
            <SelectTrigger className='h-7 text-[11px]'><SelectValue placeholder='Nivel' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='__any__'>Cualquier nivel</SelectItem>
              {levelOptions.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={libraryFilters.exerciseType || '__any__'}
            onValueChange={v => setLibraryFilters(f => ({ ...f, exerciseType: (v && v !== '__any__') ? v : undefined }))}
          >
            <SelectTrigger className='h-7 text-[11px]'><SelectValue placeholder='Tipo' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='__any__'>Cualquier tipo</SelectItem>
              {EXERCISE_TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveLibraryFilters && (
            <button
              type='button'
              className='col-span-2 text-[10px] text-muted-foreground hover:text-destructive text-center py-0.5'
              onClick={() => setLibraryFilters({})}
            >
              Quitar filtros
            </button>
          )}
        </div>
      )}

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
      ) : viewMode === 'grid' ? (
        <div className='grid grid-cols-2 gap-2'>
          {availableExercises.map(ex => (
            <button
              key={ex.id}
              type='button'
              draggable
              onDragStart={e => handleDragStart(e, ex)}
              onClick={() => handleLibraryExerciseClick(ex)}
              className='group flex flex-col items-stretch gap-1.5 rounded-xl border p-1.5 text-left transition-colors hover:bg-muted/50 hover:border-primary cursor-grab active:cursor-grabbing'
            >
              <ExerciseThumbnail src={ex.exercise_image || DEFAULT_THUMBNAIL} alt={ex.title} className='aspect-square w-full rounded-md' />
              <span className='line-clamp-2 text-[11px] font-medium leading-tight'>{ex.title}</span>
            </button>
          ))}
        </div>
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
  )

  return (
    <div className='flex flex-col h-full min-h-0'>
      {/* Header bar */}
      <div className='flex flex-col gap-3 border-b pb-3 mb-3 shrink-0'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-3 min-w-0'>
            <ExerciseThumbnail src={thumbnail || DEFAULT_THUMBNAIL} alt={title} className='size-12 rounded-xl' />
            <div className='min-w-0'>
              {renamingTitle ? (
                <input
                  className='h-7 w-full max-w-xs rounded border bg-background px-1.5 text-base font-semibold'
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onBlur={commitRenameTitle}
                  onKeyDown={e => { if (e.key === 'Enter') commitRenameTitle(); if (e.key === 'Escape') { setTitleDraft(title); setRenamingTitle(false) } }}
                  autoFocus
                />
              ) : (
                <h3
                  className={cn('text-base font-semibold truncate', !readOnly && onUpdateTitle && 'cursor-pointer hover:underline decoration-dotted')}
                  title={!readOnly && onUpdateTitle ? 'Clic para renombrar' : undefined}
                  onClick={() => { if (!readOnly && onUpdateTitle) setRenamingTitle(true) }}
                >
                  {title}
                </h3>
              )}
              <div className='flex items-center gap-2 text-xs text-muted-foreground flex-wrap'>
                <span>{allRoutineExercises.length} ejercicios</span>
                <span>• {blocks.length} bloques</span>
                {badge}
              </div>
            </div>
          </div>
          <div className='flex items-center gap-2 shrink-0 flex-wrap'>
            <Button
              size='sm'
              variant='outline'
              className='h-8 text-xs gap-1 lg:hidden'
              onClick={() => setMobileLibraryOpen(true)}
            >
              <PanelLeftIcon className='size-3.5' /> {mode === 'library' ? 'Ejercicios' : 'Índice'}
            </Button>
            {headerExtras}
            {mode === 'library' && (
              <div className='flex items-center rounded-lg border p-0.5'>
                <button
                  type='button'
                  onClick={() => setViewMode('list')}
                  title='Lista de resultados del buscador de ejercicios'
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
                  title='Cuadrícula de resultados del buscador de ejercicios'
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                    viewMode === 'grid' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <LayoutGridIcon className='size-3.5' /> Cuadrícula
                </button>
              </div>
            )}
            <div className='relative w-full sm:w-44 lg:w-56'>
              <SearchIcon className='absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
              <Input
                placeholder={mode === 'library' ? 'Filtrar este entrenamiento' : 'Buscar ejercicio'}
                className='h-8 pl-7 text-xs w-full'
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
        {/* Left panel (desktop / tablet landscape) */}
        <div className='hidden lg:flex w-60 flex-col gap-2 border-r pr-4 overflow-y-auto shrink-0'>
          {libraryPanelContent}
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
                    {/* AISLAMIENTO (auditoría 2026-09-18): bloque que este cliente añadió, no vive en la plantilla compartida. */}
                    {block.is_addition && (
                      <Badge variant='secondary' className='text-[10px] px-1.5 py-0 h-4 shrink-0'>Personalizado</Badge>
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
                    {!readOnly && (onRenameBlock || onRemoveBlock || onSaveBlockAsSection) && (
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
                          {onSaveBlockAsSection && (
                            <DropdownMenuItem onClick={() => onSaveBlockAsSection(block)}>Guardar como plantilla de sección</DropdownMenuItem>
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
                                <p className='font-medium text-sm leading-tight flex items-center gap-1.5'>
                                  {ex.title}
                                  {/* AISLAMIENTO (auditoría 2026-09-18): ejercicio que este cliente añadió, no vive en la plantilla compartida. */}
                                  {ex.is_addition && (
                                    <Badge variant='secondary' className='text-[10px] px-1.5 py-0 h-4 shrink-0'>Personalizado</Badge>
                                  )}
                                </p>
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
                                {onSubstituteExercise && !readOnly && (
                                  <Button
                                    variant='ghost'
                                    size='icon'
                                    className='size-7'
                                    onClick={() => openSubstitute(block.id, ex)}
                                    title='Sustituir ejercicio (conserva series/reps/carga)'
                                  >
                                    <RefreshCwIcon className='size-3.5' />
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

                            {ex.load_suggestion && (
                              <div className={cn(
                                'flex flex-col gap-1.5 rounded-lg border px-2.5 py-2 text-xs',
                                ex.load_suggestion.status === 'pendiente'
                                  ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
                                  : 'border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20'
                              )}>
                                <div className='flex items-center gap-1.5 flex-wrap'>
                                  <Gauge className='size-3.5 shrink-0' />
                                  <span className='font-medium'>
                                    {ex.load_suggestion.status === 'pendiente' ? 'Sugerencia de carga pendiente' : 'Carga ajustada por el motor'}
                                  </span>
                                  {(ex.load_suggestion.proposed_weight != null || ex.load_suggestion.proposed_reps != null) && (
                                    <span className='text-muted-foreground'>
                                      {[
                                        ex.load_suggestion.proposed_weight != null ? `${ex.load_suggestion.proposed_weight} kg` : null,
                                        ex.load_suggestion.proposed_reps != null ? `${ex.load_suggestion.proposed_reps} reps` : null,
                                      ].filter(Boolean).join(' × ')}
                                    </span>
                                  )}
                                </div>
                                {ex.load_suggestion.status === 'pendiente' && (
                                  <div className='flex items-center gap-1'>
                                    <Button variant='outline' size='sm' className='h-6 text-[10px] px-2 gap-1' onClick={() => onLoadSuggestionApprove?.(ex)}>
                                      <Check className='size-3' /> Aprobar
                                    </Button>
                                    <Button variant='outline' size='sm' className='h-6 text-[10px] px-2 gap-1' onClick={() => onLoadSuggestionEdit?.(ex)}>
                                      <PencilIcon className='size-3' /> Editar
                                    </Button>
                                    <Button variant='outline' size='sm' className='h-6 text-[10px] px-2 gap-1 text-destructive hover:text-destructive' onClick={() => onLoadSuggestionReject?.(ex)}>
                                      <X className='size-3' /> Rechazar
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
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

      {/* Panel de biblioteca / índice de ejercicios, colapsado a hoja lateral por debajo de lg */}
      <Sheet open={mobileLibraryOpen} onOpenChange={setMobileLibraryOpen}>
        <SheetContent side='left' className='w-[85vw] sm:w-80 p-0'>
          <SheetHeader className='border-b pb-3'>
            <SheetTitle>{mode === 'library' ? 'Biblioteca de ejercicios' : 'Índice de ejercicios'}</SheetTitle>
          </SheetHeader>
          <div className='flex flex-col gap-2 overflow-y-auto px-4 pb-4'>
            {libraryPanelContent}
          </div>
        </SheetContent>
      </Sheet>

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

      {/* Sustituir ejercicio -- reemplaza exercise_id en la misma fila,
          conserva series/reps/carga/rir/notas (a diferencia de borrar +
          añadir desde la biblioteca, que empieza en blanco). */}
      <Dialog open={!!substituteTarget} onOpenChange={open => { if (!open) setSubstituteTarget(null) }}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle className='text-sm'>
              Sustituir <span className='text-muted-foreground font-normal'>«{substituteTarget?.exercise.title}»</span>
            </DialogTitle>
          </DialogHeader>
          <p className='text-xs text-muted-foreground -mt-2'>
            Series, reps, carga, RIR/RPE y notas se mantienen — solo cambia el ejercicio.
          </p>
          <div className='relative'>
            <SearchIcon className='absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
            <Input
              autoFocus
              placeholder='Buscar ejercicio de sustitución...'
              className='h-9 pl-7 text-sm'
              value={substituteSearch}
              onChange={e => setSubstituteSearch(e.target.value)}
            />
          </div>
          <div className='max-h-80 overflow-y-auto space-y-1.5'>
            {availableExercisesLoading ? (
              <p className='text-xs text-muted-foreground text-center py-4'>Cargando ejercicios...</p>
            ) : availableExercises.length === 0 ? (
              <p className='text-xs text-muted-foreground text-center py-4'>No se encontraron ejercicios.</p>
            ) : (
              availableExercises
                .filter(ex => ex.id !== substituteTarget?.exercise.exercise_id)
                .map(ex => (
                  <button
                    key={ex.id}
                    type='button'
                    onClick={() => handleSubstitutePick(ex)}
                    className='group flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors hover:bg-muted/50 hover:border-primary'
                  >
                    <ExerciseThumbnail src={ex.exercise_image || DEFAULT_THUMBNAIL} alt={ex.title} className='size-10 rounded-md' />
                    <span className='line-clamp-2 text-xs font-medium leading-tight flex-1'>{ex.title}</span>
                  </button>
                ))
            )}
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
