
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ExternalLinkIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import WorkoutTemplateViewer, {
  type WorkoutViewerBlock,
  type WorkoutViewerExercise,
  type ExerciseLibraryFilters,
} from '@/components/coaching/WorkoutTemplateViewer'
import ExerciseTechniqueDialog, { techniquePayload, withTechnique } from '@/components/coaching/ExerciseTechniqueDialog'
import type { TechniqueDraft } from '@/lib/programSessionMatrix'

const DEFAULT_THUMBNAIL = 'https://app.hubfit.com/media/workout-thumbnails/default.jpg'

type ApiExercise = {
  id: number
  title: string
  video_url?: string | null
  exercise_image?: string | null
}

type ApiBlock = {
  id: number
  title: string | null
  instructions: string | null
  order: number
  exercises: {
    id: number
    exercise_id: number
    sequence: number
    prescribed: Record<string, any> | null
    enabled_metrics: string[] | null
    notes: string | null
    title: string | null
    exercise_image: string | null
    video_url: string | null
    last_performance?: { sets: Record<string, any>[] } | null
  }[]
}

type WorkoutDetail = {
  id: number
  title: string
  description: string | null
  thumbnail?: string | null
  blocks: ApiBlock[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workoutTemplateId: number
  onEdit?: (id: number) => void
  // Cuando se pasa (ej. desde el perfil de un cliente en /users/:id), el
  // detalle incluye lo que ESE cliente uso realmente la ultima vez en cada
  // ejercicio, para poder ajustar la carga prescrita sin salir del modal.
  clientId?: number
}

function youtubeThumbnail(url?: string | null): string | null {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? `https://img.youtube.com/vi/${match[1]}/sddefault.jpg` : null
}

export default function WorkoutPreviewModal({ open, onOpenChange, workoutTemplateId, onEdit, clientId }: Props) {
  const [detail, setDetail] = useState<WorkoutDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [availableExercises, setAvailableExercises] = useState<WorkoutViewerExercise[]>([])
  const [availableLoading, setAvailableLoading] = useState(false)
  const [notesExercise, setNotesExercise] = useState<WorkoutViewerExercise | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [techniqueExercise, setTechniqueExercise] = useState<WorkoutViewerExercise | null>(null)

  const fetchDetail = useCallback(async () => {
    if (!workoutTemplateId) return
    setLoading(true)
    try {
      const query = clientId ? `id=${workoutTemplateId}&client_id=${clientId}` : `id=${workoutTemplateId}`
      const res = await api.get(`/admin/workout-template-detail?${query}`)
      const payload: WorkoutDetail = res.data?.data || res.data || null
      setDetail(payload)
    } catch {
      toast.error('No se pudieron cargar los detalles del entrenamiento')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [workoutTemplateId, clientId])

  const fetchAvailableExercises = useCallback(async (search: string, filters: ExerciseLibraryFilters = {}) => {
    setAvailableLoading(true)
    try {
      const params = new URLSearchParams({ search, per_page: '500' })
      if (filters.bodypartId) params.set('bodypart_id', String(filters.bodypartId))
      if (filters.equipmentId) params.set('equipment_id', String(filters.equipmentId))
      if (filters.levelId) params.set('level_id', String(filters.levelId))
      if (filters.exerciseType) params.set('exercise_type', filters.exerciseType)
      const res = await api.get(`/admin/exercises?${params.toString()}`)
      const items: ApiExercise[] = res.data?.data || res.data || []
      setAvailableExercises(items.map(e => ({
        id: e.id,
        title: e.title,
        exercise_image: e.exercise_image || youtubeThumbnail(e.video_url) || DEFAULT_THUMBNAIL,
        video_url: e.video_url,
      })))
    } catch {
      toast.error('No se pudieron cargar los ejercicios')
    } finally {
      setAvailableLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !workoutTemplateId) {
      setDetail(null)
      setAvailableExercises([])
      setNotesExercise(null)
      return
    }
    fetchDetail()
    fetchAvailableExercises('')
  }, [open, workoutTemplateId, fetchDetail, fetchAvailableExercises])

  // Actualizaciones optimistas en el estado local (`setDetail` en el sitio,
  // sin recargar toda la plantilla) para cada edicion de campo/nota/metrica -
  // antes cada blur disparaba un fetchDetail() completo (POST + GET de la
  // plantilla entera), notandose como parpadeo/lentitud en cada tecla
  // soltada. Solo los cambios estructurales (añadir/quitar bloque o
  // ejercicio) siguen recargando, porque ahi si hace falta el id real
  // que devuelve el backend.
  const updateExerciseLocally = (exerciseId: number, patch: Partial<ApiBlock['exercises'][number]>) => {
    setDetail(prev => prev ? {
      ...prev,
      blocks: prev.blocks.map(b => ({
        ...b,
        exercises: b.exercises.map(e => e.id === exerciseId ? { ...e, ...patch } : e),
      })),
    } : prev)
  }

  const updateBlockLocally = (blockId: number, patch: Partial<ApiBlock>) => {
    setDetail(prev => prev ? {
      ...prev,
      blocks: prev.blocks.map(b => b.id === blockId ? { ...b, ...patch } : b),
    } : prev)
  }

  const handleUpdateTitle = async (title: string) => {
    setDetail(prev => prev ? { ...prev, title } : prev)
    try {
      await api.post('/admin/workout-template-update', { id: workoutTemplateId, title })
      toast.success('Nombre actualizado')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.data?.message || 'No se pudo renombrar el entrenamiento')
      fetchDetail()
    }
  }

  const handleAddBlock = async (title: string) => {
    try {
      await api.post('/admin/workout-template-block-store', {
        workout_template_id: workoutTemplateId,
        title,
      })
      toast.success('Sección añadida')
      fetchDetail()
    } catch {
      toast.error('No se pudo añadir la sección')
    }
  }

  const handleRenameBlock = async (blockId: number, title: string) => {
    updateBlockLocally(blockId, { title })
    try {
      await api.post('/admin/workout-template-block-update', { id: blockId, title })
    } catch {
      toast.error('No se pudo renombrar el bloque')
    }
  }

  const handleRemoveBlock = async (blockId: number) => {
    try {
      await api.post('/admin/workout-template-block-delete', { id: blockId })
      toast.success('Bloque eliminado')
      fetchDetail()
    } catch {
      toast.error('No se pudo eliminar el bloque')
    }
  }

  const handleUpdateBlockInstructions = async (blockId: number, value: string) => {
    updateBlockLocally(blockId, { instructions: value || null })
    try {
      await api.post('/admin/workout-template-block-instructions', { id: blockId, instructions: value || null })
    } catch {
      toast.error('No se pudieron guardar las instrucciones')
    }
  }

  const handleAddExercise = async (blockId: number, exercise: WorkoutViewerExercise) => {
    try {
      // Sin prescribed/enabled_metrics por defecto: el coach los rellena
      // el mismo desde la tabla, usando el catalogo real de metricas (antes
      // se mandaba {sets:''} y claves en ingles que no existen en el
      // catalogo real, dejando el ejercicio con columnas irreconocibles).
      await api.post('/admin/workout-template-exercise-save', {
        workout_template_block_id: blockId,
        exercise_id: exercise.id,
        prescribed: {},
        enabled_metrics: [],
      })
      toast.success('Ejercicio añadido')
      fetchDetail()
    } catch {
      toast.error('No se pudo añadir el ejercicio')
    }
  }

  const handleRemoveExercise = async (blockId: number, exerciseId: number) => {
    try {
      await api.post('/admin/workout-template-exercise-delete', { id: exerciseId })
      toast.success('Ejercicio eliminado')
      fetchDetail()
    } catch {
      toast.error('No se pudo eliminar el ejercicio')
    }
  }

  const handleUpdateField = async (exercise: WorkoutViewerExercise, blockId: number, field: string, value: string) => {
    updateExerciseLocally(exercise.id, { prescribed: { ...exercise.prescribed, [field]: value || null } })
    try {
      await api.post('/admin/workout-template-exercise-update-field', {
        id: exercise.id,
        field,
        value: value || null,
      })
    } catch {
      toast.error('No se pudo actualizar el campo')
    }
  }

  const handleUpdateMetrics = async (exercise: WorkoutViewerExercise, blockId: number, metrics: string[]) => {
    const cleanMetrics = metrics.filter(Boolean)
    updateExerciseLocally(exercise.id, { enabled_metrics: cleanMetrics })
    try {
      await api.post('/admin/workout-template-exercise-save', {
        id: exercise.id,
        workout_template_block_id: blockId,
        exercise_id: exercise.exercise_id || 0,
        enabled_metrics: cleanMetrics,
      })
    } catch {
      toast.error('No se pudieron actualizar las métricas')
    }
  }

  const handleSubstituteExercise = async (exercise: WorkoutViewerExercise, blockId: number, newExercise: WorkoutViewerExercise) => {
    // Misma fila (id de workout_template_exercises), solo cambia
    // exercise_id -- sin prescribed/enabled_metrics/notes/sequence en el
    // payload, saveExercise() en el backend los deja tal cual (updateOrCreate
    // solo toca las claves presentes en el payload).
    updateExerciseLocally(exercise.id, {
      exercise_id: newExercise.id,
      title: newExercise.title,
      exercise_image: newExercise.exercise_image,
      video_url: newExercise.video_url,
    })
    try {
      await api.post('/admin/workout-template-exercise-save', {
        id: exercise.id,
        workout_template_block_id: blockId,
        exercise_id: newExercise.id,
      })
      toast.success('Ejercicio sustituido')
    } catch {
      toast.error('No se pudo sustituir el ejercicio')
      fetchDetail()
    }
  }

  // Técnica especial en la plantilla de este entrenamiento (la misma que ve el
  // editor de sesiones del programa y la app).
  const handleSaveTechnique = async (t: TechniqueDraft) => {
    if (!techniqueExercise) return
    try {
      await api.post('/admin/workout-template-exercise-technique', { id: techniqueExercise.id, ...techniquePayload(t) })
      updateExerciseLocally(techniqueExercise.id, { prescribed: withTechnique(techniqueExercise.prescribed as Record<string, any> | null, t) })
      toast.success(t.key || t.recording?.on ? 'Guardado' : 'Técnica y grabación quitadas')
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar la técnica')
      throw err
    }
  }

  const handleOpenNotes = (exercise: WorkoutViewerExercise) => {
    setNotesExercise(exercise)
    setNotesValue(exercise.notes || '')
  }

  const handleSaveNotes = async () => {
    if (!notesExercise) return
    updateExerciseLocally(notesExercise.id, { notes: notesValue || null })
    try {
      await api.post('/admin/workout-template-exercise-notes', {
        id: notesExercise.id,
        notes: notesValue || null,
      })
      toast.success('Notas guardadas')
      setNotesExercise(null)
    } catch {
      toast.error('No se pudieron guardar las notas')
    }
  }

  const blocks: WorkoutViewerBlock[] = useMemo(() => detail?.blocks.map(b => ({
    id: b.id,
    title: b.title,
    instructions: b.instructions,
    exercises: b.exercises.map(e => ({
      id: e.id,
      exercise_id: e.exercise_id,
      title: e.title || `Ejercicio #${e.exercise_id}`,
      exercise_image: e.exercise_image || DEFAULT_THUMBNAIL,
      video_url: e.video_url,
      prescribed: e.prescribed,
      notes: e.notes,
      enabled_metrics: e.enabled_metrics,
      last_performance: e.last_performance,
    })),
  })) ?? [], [detail])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='w-[95vw] h-[92vh] max-w-[1400px] p-0 flex flex-col overflow-hidden rounded-2xl'
        style={{ width: '95vw', maxWidth: '1400px', height: '92vh' }}
        showCloseButton={false}
      >
        <DialogHeader className='px-3 py-3 sm:px-6 sm:py-4 border-b shrink-0'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='flex items-center gap-3 min-w-0'>
              <DialogTitle className='text-base truncate'>Vista previa del entrenamiento</DialogTitle>
              <Badge variant='secondary' className='text-xs shrink-0'>{detail?.blocks.length ?? 0} bloques</Badge>
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              {onEdit && (
                <Button variant='outline' size='sm' onClick={() => { onEdit(workoutTemplateId); onOpenChange(false) }}>
                  <ExternalLinkIcon className='size-3 mr-1' /> Editar
                </Button>
              )}
              <Button variant='ghost' size='icon-sm' onClick={() => onOpenChange(false)}>
                <XIcon className='size-4' />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className='flex-1 overflow-hidden p-3 sm:p-6 min-h-0'>
          {loading ? (
            <div className='flex items-center justify-center h-full'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : !detail ? (
            <p className='text-sm text-muted-foreground text-center py-8'>Sin datos disponibles.</p>
          ) : (
            <WorkoutTemplateViewer
              title={detail.title}
              description={detail.description}
              thumbnail={detail.thumbnail || DEFAULT_THUMBNAIL}
              blocks={blocks}
              mode='library'
              availableExercises={availableExercises}
              availableExercisesLoading={availableLoading}
              onUpdateTitle={handleUpdateTitle}
              onAddBlock={handleAddBlock}
              onRenameBlock={handleRenameBlock}
              onRemoveBlock={handleRemoveBlock}
              onUpdateBlockInstructions={handleUpdateBlockInstructions}
              onAddExercise={handleAddExercise}
              onRemoveExercise={handleRemoveExercise}
              onUpdateExerciseField={handleUpdateField}
              onUpdateExerciseMetrics={handleUpdateMetrics}
              onExerciseNotes={handleOpenNotes}
              onExerciseTechnique={ex => setTechniqueExercise(ex)}
              onSubstituteExercise={handleSubstituteExercise}
              onSearchExercises={fetchAvailableExercises}
              headerExtras={
                onEdit ? (
                  <Button variant='outline' size='sm' className='h-8 text-xs' onClick={() => { onEdit(workoutTemplateId); onOpenChange(false) }}>
                    <ExternalLinkIcon className='size-3 mr-1' /> Editar plantilla
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      </DialogContent>

      <ExerciseTechniqueDialog
        exercise={techniqueExercise}
        description='Se guarda en este entrenamiento.'
        onClose={() => setTechniqueExercise(null)}
        onSave={handleSaveTechnique}
      />

      <Dialog open={!!notesExercise} onOpenChange={open => { if (!open) setNotesExercise(null) }}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Notas del ejercicio — {notesExercise?.title}</DialogTitle>
          </DialogHeader>
          <Textarea
            className='min-h-[120px] text-sm'
            value={notesValue}
            onChange={e => setNotesValue(e.target.value)}
            placeholder='Notas del entrenador para este ejercicio...'
          />
          <div className='flex justify-end gap-2 mt-2'>
            <Button variant='outline' size='sm' onClick={() => setNotesExercise(null)}>Cancelar</Button>
            <Button size='sm' onClick={handleSaveNotes}>Guardar notas</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
