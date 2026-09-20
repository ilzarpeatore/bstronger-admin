import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ArrowLeftIcon,
  XIcon,
  DumbbellIcon,
  FlameIcon,
  TrophyIcon,
  TimerIcon,
  MessageSquareTextIcon,
  BarChart3Icon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { fetchExerciseBodyparts, primaryBodypart } from '@/lib/muscle-groups'
import WorkoutTemplateViewer, {
  type WorkoutViewerExercise,
  type WorkoutViewerBlock,
  type ExerciseLibraryFilters,
} from '@/components/coaching/WorkoutTemplateViewer'

type Prescribed = Record<string, string | number | null | undefined>

type LoggedSet = {
  set: number
  weight: number
  reps: number
  rpe_rir: string | number | null
  one_rm: number
  volume: number
}

type LoadSuggestion = {
  id: number
  status: 'pendiente' | 'aplicado'
  proposed_weight: number | null
  proposed_reps: number | null
  resolved_at: string | null
  rule_name: string | null
}

type SessionExercise = {
  exercise_id: number
  // AISLAMIENTO (auditoría 2026-09-18): null cuando es un ejercicio añadido
  // solo para este cliente (client_exercise_override_id presente en su
  // lugar) -- ya no existe como WorkoutTemplateExercise real, ver
  // SessionDetailController::addExercise en el backend.
  workout_template_exercise_id: number | null
  client_exercise_override_id?: number | null
  is_addition?: boolean
  title: string
  exercise_image?: string | null
  video_url?: string | null
  prescribed: Prescribed | null
  notes: string | null
  client_note: string | null
  enabled_metrics?: string[] | null
  logged: boolean
  sets: LoggedSet[]
  prs_this_session?: number
  exercise_volume?: number
  load_suggestion?: LoadSuggestion | null
  last_performance?: { sets: Record<string, any>[] } | null
}

type SessionBlock = {
  // AISLAMIENTO (auditoría 2026-09-18): null cuando es un bloque añadido
  // solo para este cliente (client_block_override_id presente en su lugar).
  block_id: number | null
  client_block_override_id?: number | null
  is_addition?: boolean
  title: string | null
  instructions?: string | null
  exercises: SessionExercise[]
}

type SessionData = {
  title: string
  date: string
  difficulty_label: string | null
  comment: string | null
  total_sets: number
  total_volume: number
  total_reps: number
  total_prs: number
  blocks: SessionBlock[]
}

type SessionDetailModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Un entrenamiento tiene UNO de estos dos orígenes (nunca ambos):
  // - programDayAssignmentId: día de un programa asignado en calendario.
  // - workoutTemplateId + date: workout suelto (sin asignación), la fecha
  //   distingue sesiones distintas del mismo workout suelto.
  programDayAssignmentId?: number | null
  workoutTemplateId?: number | null
  date?: string | null
  clientId: number
  // Notas por ejercicio del cliente (endpoint client-session-feedback) para
  // mostrarlas junto a cada ejercicio aunque el endpoint de detalle no las incluya.
  exerciseNotes?: { exercise_title: string; notes: string; date?: string | null }[]
}

function buildSessionDetailQuery(params: { programDayAssignmentId?: number | null; workoutTemplateId?: number | null; date?: string | null; clientId: number | string }) {
  const qs = new URLSearchParams()
  if (params.programDayAssignmentId) qs.set('program_day_assignment_id', String(params.programDayAssignmentId))
  else if (params.workoutTemplateId) {
    qs.set('workout_template_id', String(params.workoutTemplateId))
    if (params.date) qs.set('date', params.date)
  }
  qs.set('client_id', String(params.clientId))
  return qs.toString()
}

const DEFAULT_THUMBNAIL = 'https://app.hubfit.com/media/workout-thumbnails/default.jpg'

// AISLAMIENTO (auditoría 2026-09-18): id estable para un ejercicio/bloque de
// sesión sea cual sea su origen -- real de la plantilla (positivo) o
// "adición" de este cliente (client_exercise_override_id/
// client_block_override_id, sin id real, se usa negado). Centralizado aquí
// para no repetir `?? -(x || 0)` en cada sitio que necesita una key estable.
function sessionExerciseKey(e: SessionExercise): number {
  return e.workout_template_exercise_id ?? -(e.client_exercise_override_id || 0)
}

function sessionBlockKey(b: SessionBlock): number {
  return b.block_id ?? -(b.client_block_override_id || 0)
}

/** Payload correcto para los endpoints de override según el id (ver sessionExerciseKey): positivo = ejercicio real, negativo = adición propia. */
function overrideIdentity(id: number): { workout_template_exercise_id?: number; client_exercise_override_id?: number } {
  return id < 0 ? { client_exercise_override_id: -id } : { workout_template_exercise_id: id }
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getThumbnail(ex: SessionExercise) {
  return ex.exercise_image || DEFAULT_THUMBNAIL
}

function isSessionCompleted(sessionData: SessionData) {
  return sessionData.blocks.some(b => b.exercises.some(e => e.logged && e.sets.length > 0))
}

function countExercises(sessionData: SessionData) {
  return sessionData.blocks.reduce((sum, b) => sum + b.exercises.length, 0)
}

function estimatedSets(sessionData: SessionData) {
  return sessionData.blocks.reduce((sum, b) => sum + b.exercises.reduce((s, ex) => {
    const series = Number(ex.prescribed?.series ?? 0)
    return s + (isNaN(series) ? 0 : series)
  }, 0), 0)
}

function mapSessionToViewer(sessionData: SessionData): {
  blocks: WorkoutViewerBlock[]
  totalExercises: number
  totalSets: number
} {
  return {
    // AISLAMIENTO (auditoría 2026-09-18): bloques/ejercicios "añadidos solo
    // para este cliente" no tienen block_id/workout_template_exercise_id
    // real (son null) -- se usa -client_*_override_id como id sintético
    // (nunca colisiona con un id real, siempre positivo). overrideIdentity()
    // sabe deshacer esto al mandar la petición de vuelta al backend (ver
    // handleOverrideField/handleSaveNotes/flushBatch/handleRemoveExercise).
    blocks: sessionData.blocks.map(b => ({
      id: sessionBlockKey(b),
      title: b.title,
      instructions: b.instructions,
      is_addition: b.is_addition,
      exercises: b.exercises.map(e => ({
        id: sessionExerciseKey(e),
        exercise_id: e.exercise_id,
        title: e.title,
        exercise_image: getThumbnail(e),
        video_url: e.video_url,
        prescribed: e.prescribed,
        notes: e.notes,
        client_note: e.client_note,
        enabled_metrics: e.enabled_metrics,
        logged: e.logged,
        sets: e.sets,
        prs_this_session: e.prs_this_session,
        exercise_volume: e.exercise_volume,
        load_suggestion: e.load_suggestion,
        last_performance: e.last_performance,
        is_addition: e.is_addition,
      })),
    })),
    totalExercises: countExercises(sessionData),
    totalSets: estimatedSets(sessionData),
  }
}

function StatCard({
  icon: Icon,
  value,
  label,
  colorClass,
}: {
  icon: React.ElementType
  value: React.ReactNode
  label: string
  colorClass?: string
}) {
  return (
    <div className='flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm'>
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', colorClass || 'bg-muted')}>
        <Icon className='size-5' />
      </div>
      <div>
        <p className='text-lg font-bold leading-tight'>{value}</p>
        <p className='text-xs text-muted-foreground'>{label}</p>
      </div>
    </div>
  )
}

// Volumen = suma de (peso x reps) de cada serie registrada.
function computeSessionStats(sessionData: SessionData) {
  let totalSets = 0
  let totalVolume = 0
  let totalReps = 0
  let totalPrs = 0
  for (const b of sessionData.blocks) {
    for (const ex of b.exercises) {
      for (const s of ex.sets) {
        totalSets += 1
        if (typeof s.weight === 'number' && typeof s.reps === 'number') {
          totalVolume += s.weight * s.reps
          totalReps += s.reps
        }
      }
      totalPrs += ex.prs_this_session ?? 0
    }
  }
  return { totalSets, totalVolume, totalReps, totalPrs }
}

function MuscleVolumeCard({ sessionData }: { sessionData: SessionData }) {
  const [bodyparts, setBodyparts] = useState<Map<number, string[]>>(new Map())
  useEffect(() => {
    let active = true
    fetchExerciseBodyparts()
      .then(map => { if (active) setBodyparts(map) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const volumes = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of sessionData.blocks) {
      for (const ex of b.exercises) {
        const group = primaryBodypart(bodyparts.get(ex.exercise_id) ?? [])
        if (!group) continue
        const volume = ex.sets.reduce((acc, s) => acc + (typeof s.weight === 'number' && typeof s.reps === 'number' ? s.weight * s.reps : 0), 0)
        if (volume > 0) map.set(group, (map.get(group) ?? 0) + volume)
      }
    }
    return Array.from(map.entries())
      .map(([group, volume]) => ({ group, volume }))
      .sort((a, b) => b.volume - a.volume)
  }, [sessionData, bodyparts])

  if (volumes.length === 0) return null
  const max = Math.max(...volumes.map(v => v.volume), 1)

  return (
    <div className='rounded-2xl border p-4 space-y-3'>
      <div className='flex items-center gap-2'>
        <BarChart3Icon className='size-4' />
        <h4 className='font-semibold text-sm'>Volumen por grupo muscular</h4>
      </div>
      <div className='space-y-2'>
        {volumes.map(v => (
          <div key={v.group} className='space-y-1'>
            <div className='flex items-center justify-between text-xs'>
              <span className='font-medium capitalize'>{v.group}</span>
              <span className='text-muted-foreground'>{v.volume.toLocaleString('es-ES')} kg</span>
            </div>
            <div className='h-2 rounded-full bg-muted overflow-hidden'>
              <div
                className='h-full rounded-full bg-primary/70'
                style={{ width: `${Math.max(4, Math.round((v.volume / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExerciseThumbnail({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-muted shrink-0', className)}>
      <img src={src} alt={alt} loading='lazy' decoding='async' className='size-full object-cover' />
    </div>
  )
}

function CompletedView({
  sessionData,
  onNotes,
}: {
  sessionData: SessionData
  // Ausente para workouts sueltos (sin asignacion de calendario) - no
  // existe una anulacion de cliente que editar ahi, se oculta el boton.
  onNotes?: (ex: SessionExercise) => void
}) {
  // Volumen recalculado a partir de las series registradas (fuente de verdad
  // visible en la tabla) para no depender de los totales del backend.
  const stats = useMemo(() => computeSessionStats(sessionData), [sessionData])

  return (
    <div className='space-y-6'>
      {(sessionData.difficulty_label || sessionData.comment) && (
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-muted/30 px-4 py-3'>
          {sessionData.difficulty_label && <Badge variant='secondary' className='text-xs'>{sessionData.difficulty_label}</Badge>}
          {sessionData.comment && <p className='text-sm text-muted-foreground'>{sessionData.comment}</p>}
        </div>
      )}

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        <StatCard icon={FlameIcon} value={stats.totalSets} label='Series totales' colorClass='bg-red-100 text-red-600' />
        <StatCard icon={DumbbellIcon} value={`${stats.totalVolume.toLocaleString('es-ES')} kg`} label='Volumen total' colorClass='bg-amber-100 text-amber-600' />
        <StatCard icon={TimerIcon} value={stats.totalReps} label='Reps totales' colorClass='bg-emerald-100 text-emerald-600' />
        <StatCard icon={TrophyIcon} value={stats.totalPrs} label='Nuevos récords' colorClass='bg-blue-100 text-blue-600' />
      </div>

      <MuscleVolumeCard sessionData={sessionData} />

      <Separator />

      <div className='flex items-center justify-between'>
        <h4 className='font-semibold'>Actividad</h4>
        <Badge variant={sessionData.difficulty_label ? 'default' : 'outline'}>
          {sessionData.difficulty_label || 'Sin valoración'}
        </Badge>
      </div>

      {sessionData.blocks.map(block => (
        <div key={sessionBlockKey(block)} className='rounded-2xl border overflow-hidden'>
          <div className='bg-muted/40 px-4 py-3 flex items-center gap-2'>
            <p className='font-semibold text-sm'>{block.title || `Bloque #${block.block_id}`}</p>
            {block.is_addition && <Badge variant='secondary' className='text-[10px] px-1.5 py-0 h-4'>Personalizado</Badge>}
          </div>
          <div className='divide-y'>
            {block.exercises.map(ex => (
              <div key={sessionExerciseKey(ex)} className='p-4'>
                <div className='flex items-start gap-3 mb-3'>
                  <ExerciseThumbnail src={getThumbnail(ex)} alt={ex.title} className='size-14' />
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-2'>
                      <p className='font-medium text-sm flex items-center gap-1.5'>
                        {ex.title}
                        {ex.is_addition && <Badge variant='secondary' className='text-[10px] px-1.5 py-0 h-4'>Personalizado</Badge>}
                      </p>
                      {onNotes && (
                        <Button variant='ghost' size='icon' className='size-7 shrink-0' onClick={() => onNotes(ex)}>
                          <MessageSquareTextIcon className='size-3.5' />
                        </Button>
                      )}
                    </div>
                    {ex.notes && <p className='text-xs text-muted-foreground mt-0.5'>Nota del coach: {ex.notes}</p>}
                    {ex.client_note && (
                      <p className='text-xs text-blue-600 mt-0.5'>
                        <MessageSquareTextIcon className='size-3 inline mr-1 -mt-0.5' />
                        Feedback del cliente: {ex.client_note}
                      </p>
                    )}
                    {ex.prs_this_session ? (
                      <Badge className='mt-1 text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-100'>
                        <TrophyIcon className='size-3 mr-1' /> {ex.prs_this_session} PR{ex.prs_this_session > 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {ex.sets.length > 0 ? (
                  <div className='overflow-x-auto rounded-xl border'>
                    <table className='w-full text-xs'>
                      <thead className='bg-muted/50'>
                        <tr>
                          <th className='px-2 py-2 text-center font-medium'>Serie</th>
                          <th className='px-2 py-2 text-center font-medium'>Peso</th>
                          <th className='px-2 py-2 text-center font-medium'>Reps</th>
                          <th className='px-2 py-2 text-center font-medium'>RPE/RIR</th>
                          <th className='px-2 py-2 text-center font-medium'>1RM</th>
                          <th className='px-2 py-2 text-center font-medium'>Vol</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y'>
                        {ex.sets.map((set, idx) => (
                          <tr key={idx} className={idx === ex.sets.length - 1 ? 'bg-muted/20' : ''}>
                            <td className='px-2 py-2 text-center'>{set.set}</td>
                            <td className='px-2 py-2 text-center'>{set.weight} kg</td>
                            <td className='px-2 py-2 text-center'>{set.reps}</td>
                            <td className='px-2 py-2 text-center'>{set.rpe_rir ?? '-'}</td>
                            <td className='px-2 py-2 text-center'>{set.one_rm || '-'} kg</td>
                            <td className='px-2 py-2 text-center font-medium'>{set.volume} kg</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className='text-xs text-muted-foreground'>No registrado</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SessionContent({
  sessionData,
  programDayAssignmentId,
  clientId,
  onBack,
  onUpdate,
}: {
  sessionData: SessionData
  // Vacio quiere decir que la sesion es un workout suelto (sin asignacion
  // de calendario) - en ese caso solo se admite la vista de solo lectura
  // (CompletedView); la edicion de plantilla no aplica a un workout suelto
  // visto desde el perfil de un cliente concreto.
  programDayAssignmentId?: string
  clientId: string
  onBack: () => void
  onUpdate: (data: SessionData) => void
}) {
  const [notesDialogExercise, setNotesDialogExercise] = useState<SessionExercise | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [availableExercises, setAvailableExercises] = useState<WorkoutViewerExercise[]>([])
  const [availableLoading, setAvailableLoading] = useState(false)

  const completed = isSessionCompleted(sessionData)
  const viewerData = useMemo(() => mapSessionToViewer(sessionData), [sessionData])
  const { blocks } = viewerData

  const exerciseLookup = useMemo(() => {
    const map = new Map<number, SessionExercise>()
    for (const b of sessionData.blocks) {
      for (const e of b.exercises) {
        map.set(sessionExerciseKey(e), e)
      }
    }
    return map
  }, [sessionData])

  // Motor de Auto-Regulación de Carga: aprobar/editar/rechazar una
  // sugerencia directamente desde el visualizador de la sesión, en vez de
  // obligar al coach a ir al panel de excepciones aparte -- reutiliza los
  // mismos endpoints admin/session-progression/suggestions/{id}/* que ya
  // usa CoachExceptionsCard.tsx.
  const [editSuggestionExercise, setEditSuggestionExercise] = useState<SessionExercise | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editReps, setEditReps] = useState('')
  const [editMotivo, setEditMotivo] = useState('')
  const [savingSuggestion, setSavingSuggestion] = useState(false)

  const refreshSession = useCallback(async () => {
    const res = await api.get(`/admin/session-detail?program_day_assignment_id=${programDayAssignmentId}&client_id=${clientId}`)
    onUpdate(res.data ?? res)
  }, [programDayAssignmentId, clientId, onUpdate])

  const handleApproveSuggestion = async (ex: WorkoutViewerExercise) => {
    if (!ex.load_suggestion) return
    try {
      await api.post(`/admin/session-progression/suggestions/${ex.load_suggestion.id}/approve`, {})
      toast.success('Sugerencia aprobada')
      await refreshSession()
    } catch (err: any) {
      toast.error(err?.message || 'Error al aprobar la sugerencia')
    }
  }

  const handleRejectSuggestion = async (ex: WorkoutViewerExercise) => {
    if (!ex.load_suggestion) return
    try {
      await api.post(`/admin/session-progression/suggestions/${ex.load_suggestion.id}/reject`, {})
      toast.success('Sugerencia rechazada')
      await refreshSession()
    } catch (err: any) {
      toast.error(err?.message || 'Error al rechazar la sugerencia')
    }
  }

  const handleOpenEditSuggestion = (ex: WorkoutViewerExercise) => {
    const original = exerciseLookup.get(ex.id)
    if (!original?.load_suggestion) return
    setEditSuggestionExercise(original)
    setEditWeight(original.load_suggestion.proposed_weight != null ? String(original.load_suggestion.proposed_weight) : '')
    setEditReps(original.load_suggestion.proposed_reps != null ? String(original.load_suggestion.proposed_reps) : '')
    setEditMotivo('')
  }

  const handleSaveEditSuggestion = async () => {
    if (!editSuggestionExercise?.load_suggestion) return
    setSavingSuggestion(true)
    try {
      await api.post(`/admin/session-progression/suggestions/${editSuggestionExercise.load_suggestion.id}/edit`, {
        proposed_weight: editWeight !== '' ? Number(editWeight) : null,
        proposed_reps: editReps !== '' ? Number(editReps) : null,
        motivo: editMotivo || undefined,
      })
      toast.success('Sugerencia editada y aplicada')
      setEditSuggestionExercise(null)
      await refreshSession()
    } catch (err: any) {
      toast.error(err?.message || 'Error al editar la sugerencia')
    } finally {
      setSavingSuggestion(false)
    }
  }

  const batchRef = useRef<Map<number, { prescribed?: Record<string, any>; notes?: string | null }>>(new Map())
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushBatch = useCallback(async () => {
    if (batchRef.current.size === 0) return
    const entries = Array.from(batchRef.current.entries())
    batchRef.current.clear()

    for (const [exerciseId, data] of entries) {
      try {
        await api.post('/admin/session-detail-batch-update-overrides', {
          program_day_assignment_id: Number(programDayAssignmentId),
          client_id: Number(clientId),
          ...overrideIdentity(exerciseId),
          ...data,
        })
      } catch (err: any) {
        toast.error(err?.message || 'Error al actualizar')
      }
    }

    const res = await api.get(`/admin/session-detail?program_day_assignment_id=${programDayAssignmentId}&client_id=${clientId}`)
    onUpdate(res.data ?? res)
  }, [programDayAssignmentId, clientId, onUpdate])

  const scheduleFlush = useCallback(() => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
    batchTimerRef.current = setTimeout(flushBatch, 500)
  }, [flushBatch])

  useEffect(() => {
    return () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
      flushBatch()
    }
  }, [flushBatch])

  const handleOverrideField = (exercise: WorkoutViewerExercise, _blockId: number, field: string, value: string) => {
    const original = sessionData.blocks
      .flatMap(b => b.exercises)
      .find(e => sessionExerciseKey(e) === exercise.id)
    if (!original) return
    const current = original.prescribed?.[field]
    if (current === value || (current == null && value === '')) return

    onUpdate({
      ...sessionData,
      blocks: sessionData.blocks.map(b => ({
        ...b,
        exercises: b.exercises.map(e =>
          sessionExerciseKey(e) === exercise.id
            ? { ...e, prescribed: { ...e.prescribed, [field]: value || null } }
            : e
        ),
      })),
    })

    const existing = batchRef.current.get(exercise.id) || {}
    batchRef.current.set(exercise.id, {
      ...existing,
      prescribed: { ...(existing.prescribed || {}), [field]: value || null },
    })
    scheduleFlush()
  }

  const handleOpenNotes = (ex: SessionExercise) => {
    setNotesDialogExercise(ex)
    setNotesValue(ex.notes || '')
  }

  const handleSaveNotes = async () => {
    if (!notesDialogExercise) return
    const targetKey = sessionExerciseKey(notesDialogExercise)
    try {
      await api.post('/admin/session-detail-update-override-notes', {
        program_day_assignment_id: Number(programDayAssignmentId),
        client_id: Number(clientId),
        ...overrideIdentity(targetKey),
        notes: notesValue || null,
      })
      toast.success('Notas guardadas')
      onUpdate({
        ...sessionData,
        blocks: sessionData.blocks.map(b => ({
          ...b,
          exercises: b.exercises.map(e =>
            sessionExerciseKey(e) === targetKey
              ? { ...e, notes: notesValue || null }
              : e
          ),
        })),
      })
      setNotesDialogExercise(null)
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar las notas')
    }
  }

  const fetchAvailableExercises = useCallback(async (search: string, filters: ExerciseLibraryFilters = {}) => {
    setAvailableLoading(true)
    try {
      const params = new URLSearchParams({ search, per_page: '500' })
      if (filters.bodypartId) params.set('bodypart_id', String(filters.bodypartId))
      if (filters.equipmentId) params.set('equipment_id', String(filters.equipmentId))
      if (filters.levelId) params.set('level_id', String(filters.levelId))
      if (filters.exerciseType) params.set('exercise_type', filters.exerciseType)
      const res = await api.get(`/admin/exercises?${params.toString()}`)
      const items = res.data?.data || res.data || []
      setAvailableExercises(items.map((e: any) => ({
        id: e.id,
        title: e.title,
        exercise_image: e.exercise_image || DEFAULT_THUMBNAIL,
        video_url: e.video_url,
      })))
    } catch {
      toast.error('Error al cargar los ejercicios')
    } finally {
      setAvailableLoading(false)
    }
  }, [])

  const handleAddBlock = async (title: string) => {
    try {
      await api.post('/admin/session-detail-add-block', {
        program_day_assignment_id: Number(programDayAssignmentId),
        client_id: Number(clientId),
        title,
      })
      toast.success('Sección añadida')
      const res = await api.get(`/admin/session-detail?program_day_assignment_id=${programDayAssignmentId}&client_id=${clientId}`)
      onUpdate(res.data ?? res)
    } catch {
      toast.error('Error al añadir la sección')
    }
  }

  const handleAddExercise = async (blockId: number, exercise: WorkoutViewerExercise) => {
    try {
      await api.post('/admin/session-detail-add-exercise', {
        program_day_assignment_id: Number(programDayAssignmentId),
        client_id: Number(clientId),
        workout_template_block_id: blockId,
        exercise_id: exercise.id,
      })
      toast.success('Ejercicio añadido')
      const res = await api.get(`/admin/session-detail?program_day_assignment_id=${programDayAssignmentId}&client_id=${clientId}`)
      onUpdate(res.data ?? res)
    } catch {
      toast.error('Error al añadir el ejercicio')
    }
  }

  const handleRemoveExercise = async (blockId: number, exerciseId: number) => {
    try {
      await api.post('/admin/session-detail-remove-exercise', {
        program_day_assignment_id: Number(programDayAssignmentId),
        client_id: Number(clientId),
        ...overrideIdentity(exerciseId),
      })
      toast.success('Ejercicio eliminado')
      const res = await api.get(`/admin/session-detail?program_day_assignment_id=${programDayAssignmentId}&client_id=${clientId}`)
      onUpdate(res.data ?? res)
    } catch {
      toast.error('Error al eliminar el ejercicio')
    }
  }

  return (
    <div className='flex flex-col h-full min-h-0'>
      <div className='flex items-center justify-between gap-4 pb-3 border-b mb-3 shrink-0'>
        <div className='flex items-center gap-3 min-w-0'>
          <Button variant='ghost' size='sm' onClick={onBack} className='shrink-0'>
            <ArrowLeftIcon className='size-4 mr-1' /> Volver
          </Button>
          <div className='min-w-0'>
            <h2 className='text-lg font-semibold truncate'>{sessionData.title}</h2>
            <p className='text-xs text-muted-foreground'>{formatDate(sessionData.date)}</p>
          </div>
        </div>
        <Badge variant={completed ? 'default' : 'secondary'} className='text-xs shrink-0'>
          {completed ? 'Completada' : 'Programada'}
        </Badge>
      </div>

      <div className='flex-1 min-h-0 overflow-y-auto pr-1'>
      {completed ? (
        <CompletedView sessionData={sessionData} onNotes={programDayAssignmentId ? handleOpenNotes : undefined} />
      ) : !programDayAssignmentId ? (
        // Workout suelto sin ninguna serie registrada (el cliente pulso
        // "Finalizar igualmente" sin apuntar nada) - no hay asignacion de
        // calendario que editar aqui, solo mostrar que no hay datos.
        <div className='flex flex-col items-center justify-center py-16 text-muted-foreground'>
          <p className='text-sm'>El cliente finalizó esta sesión sin registrar ninguna serie.</p>
        </div>
      ) : (
        <WorkoutTemplateViewer
          title={sessionData.title}
          description={sessionData.comment}
          thumbnail={DEFAULT_THUMBNAIL}
          blocks={blocks}
          mode='library'
          prescribedReadOnly={false}
          availableExercises={availableExercises}
          availableExercisesLoading={availableLoading}
          onAddBlock={handleAddBlock}
          onAddExercise={handleAddExercise}
          onRemoveExercise={handleRemoveExercise}
          onUpdateExerciseField={handleOverrideField}
          onExerciseNotes={(ex) => {
            const original = exerciseLookup.get(ex.id)
            if (original) handleOpenNotes(original)
          }}
          onSearchExercises={fetchAvailableExercises}
          onLoadSuggestionApprove={handleApproveSuggestion}
          onLoadSuggestionEdit={handleOpenEditSuggestion}
          onLoadSuggestionReject={handleRejectSuggestion}
        />
      )}
      </div>

      <Dialog open={!!notesDialogExercise} onOpenChange={open => { if (!open) setNotesDialogExercise(null) }}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Notas del coach — {notesDialogExercise?.title}</DialogTitle>
          </DialogHeader>
          <Textarea
            className='min-h-[120px] text-sm'
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            placeholder='Notas del coach para este ejercicio...'
          />
          <div className='flex justify-end gap-2 mt-2'>
            <Button variant='outline' onClick={() => setNotesDialogExercise(null)}>Cancelar</Button>
            <Button onClick={handleSaveNotes}>Guardar notas</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSuggestionExercise} onOpenChange={open => { if (!open) setEditSuggestionExercise(null) }}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Editar sugerencia — {editSuggestionExercise?.title}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <label className='text-xs font-medium text-muted-foreground'>Peso (kg)</label>
                <Input type='number' value={editWeight} onChange={e => setEditWeight(e.target.value)} placeholder='—' />
              </div>
              <div className='space-y-1'>
                <label className='text-xs font-medium text-muted-foreground'>Reps</label>
                <Input type='number' value={editReps} onChange={e => setEditReps(e.target.value)} placeholder='—' />
              </div>
            </div>
            <div className='space-y-1'>
              <label className='text-xs font-medium text-muted-foreground'>Motivo (opcional)</label>
              <Textarea
                className='min-h-[60px] text-sm'
                value={editMotivo}
                onChange={e => setEditMotivo(e.target.value)}
                placeholder='Por qué se ajusta la sugerencia del motor...'
              />
            </div>
          </div>
          <div className='flex justify-end gap-2 mt-2'>
            <Button variant='outline' onClick={() => setEditSuggestionExercise(null)} disabled={savingSuggestion}>Cancelar</Button>
            <Button onClick={handleSaveEditSuggestion} disabled={savingSuggestion}>
              {savingSuggestion ? 'Guardando...' : 'Guardar y aplicar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SessionDetailView() {
  const [programDayAssignmentId, setProgramDayAssignmentId] = useState('')
  const [clientId, setClientId] = useState('')
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLoadSession = async () => {
    if (!programDayAssignmentId || !clientId) {
      toast.error('Introduce tanto el ID de asignación del día del programa como el ID del cliente')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(
        `/admin/session-detail?program_day_assignment_id=${programDayAssignmentId}&client_id=${clientId}`
      )
      const payload: SessionData = res.data ?? res
      setSessionData(payload)
    } catch (err: any) {
      setError(err?.message || 'Error al cargar la sesión')
      setSessionData(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className='p-6'>
        {!sessionData ? (
          <div className='space-y-4 max-w-md'>
            <p className='text-sm text-muted-foreground'>
              Introduce un ID de asignación del día del programa y un ID de cliente para ver los detalles de la sesión.
            </p>
            <div className='space-y-3'>
              <div className='space-y-1.5'>
                <label className='text-sm font-medium'>ID de asignación del día del programa</label>
                <Input
                  type='number'
                  value={programDayAssignmentId}
                  onChange={e => setProgramDayAssignmentId(e.target.value)}
                  placeholder='p. ej. 123'
                />
              </div>
              <div className='space-y-1.5'>
                <label className='text-sm font-medium'>ID del cliente</label>
                <Input
                  type='number'
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder='p. ej. 5'
                />
              </div>
            </div>
            <Button onClick={handleLoadSession} disabled={loading}>
              {loading ? 'Cargando...' : 'Cargar sesión'}
            </Button>
            {error && <p className='text-sm text-destructive'>{error}</p>}
          </div>
        ) : (
          <SessionContent
            sessionData={sessionData}
            programDayAssignmentId={programDayAssignmentId}
            clientId={clientId}
            onBack={() => setSessionData(null)}
            onUpdate={data => setSessionData(data)}
          />
        )}
      </CardContent>
    </Card>
  )
}

export function SessionDetailModal({
  open,
  onOpenChange,
  programDayAssignmentId,
  workoutTemplateId,
  date,
  clientId,
  exerciseNotes,
}: SessionDetailModalProps) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasIdentifier = !!programDayAssignmentId || !!workoutTemplateId

  useEffect(() => {
    if (!open || !hasIdentifier || !clientId) {
      setSessionData(null)
      setError(null)
      return
    }

    const fetchSession = async () => {
      setLoading(true)
      setError(null)
      try {
        const query = buildSessionDetailQuery({ programDayAssignmentId, workoutTemplateId, date, clientId })
        const res = await api.get(`/admin/session-detail?${query}`)
        const payload: SessionData = res.data ?? res
        if (exerciseNotes?.length) {
          const dayKey = payload.date ? String(payload.date).slice(0, 10) : ''
          const merged: SessionData = {
            ...payload,
            blocks: payload.blocks.map(b => ({
              ...b,
              exercises: b.exercises.map(ex => {
                const byDate = exerciseNotes.find(n => n.exercise_title === ex.title && n.date && String(n.date).slice(0, 10) === dayKey)
                const match = byDate || exerciseNotes.find(n => n.exercise_title === ex.title)
                return match ? { ...ex, client_note: ex.client_note || match.notes } : ex
              }),
            })),
          }
          setSessionData(merged)
        } else {
          setSessionData(payload)
        }
      } catch (err: any) {
        setError(err?.message || 'Error al cargar el detalle de la sesión')
        setSessionData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [open, hasIdentifier, programDayAssignmentId, workoutTemplateId, date, clientId, exerciseNotes])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='w-[95vw] h-[92vh] max-w-[1400px] p-0 flex flex-col overflow-hidden rounded-2xl'
        style={{ width: '95vw', maxWidth: '1400px', height: '92vh' }}
        showCloseButton={false}
      >
        <DialogHeader className='px-3 py-3 sm:px-6 sm:py-4 border-b shrink-0'>
          <div className='flex items-center justify-between'>
            <DialogTitle className='text-base'>Detalle de la sesión</DialogTitle>
            <Button variant='ghost' size='icon-sm' onClick={() => onOpenChange(false)}>
              <XIcon className='size-4' />
            </Button>
          </div>
        </DialogHeader>
        <div className='flex-1 overflow-hidden p-3 sm:p-6 min-h-0'>
          {loading ? (
            <div className='flex items-center justify-center h-full'>
              <p className='text-sm text-muted-foreground'>Cargando el detalle de la sesión...</p>
            </div>
          ) : error ? (
            <div className='rounded-md bg-destructive/10 p-4 text-sm text-destructive'>
              {error}
            </div>
          ) : sessionData ? (
            <SessionContent
              sessionData={sessionData}
              programDayAssignmentId={programDayAssignmentId ? String(programDayAssignmentId) : undefined}
              clientId={String(clientId)}
              onBack={() => onOpenChange(false)}
              onUpdate={data => setSessionData(data)}
            />
          ) : (
            <div className='flex items-center justify-center h-full'>
              <p className='text-sm text-muted-foreground'>No hay datos de sesión disponibles.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
