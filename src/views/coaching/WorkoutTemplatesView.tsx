import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ArrowLeftIcon, DownloadIcon, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import WorkoutTemplateViewer, {
  type WorkoutViewerBlock,
  type WorkoutViewerExercise,
  type ExerciseLibraryFilters,
} from '@/components/coaching/WorkoutTemplateViewer'
import ExerciseTechniqueDialog, { techniquePayload, withTechnique } from '@/components/coaching/ExerciseTechniqueDialog'
import type { TechniqueDraft } from '@/lib/programSessionMatrix'
import WorkoutTemplatesList from './WorkoutTemplatesList'
import type { TemplateListItem } from './workoutTemplateGroups'

const DEFAULT_THUMBNAIL = 'https://app.hubfit.com/media/workout-thumbnails/default.jpg'

type ApiExercise = {
  id: number
  title: string
  video_url?: string | null
  exercise_image?: string | null
}

type ApiBlockExercise = {
  id: number
  exercise_id: number
  sequence: number
  prescribed: Record<string, any> | null
  enabled_metrics: string[] | null
  notes: string | null
  title: string | null
  exercise_image: string | null
  video_url: string | null
}

type ApiBlock = {
  id: number
  title: string | null
  instructions: string | null
  order: number
  exercises: ApiBlockExercise[]
}

type WorkoutDetail = {
  id: number
  title: string
  description: string | null
  thumbnail?: string | null
  blocks: ApiBlock[]
}

type WorkoutTemplateListItem = TemplateListItem

type SectionTemplate = {
  id: number
  title: string
}

function youtubeThumbnail(url?: string | null): string | null {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  return match ? `https://img.youtube.com/vi/${match[1]}/sddefault.jpg` : null
}

export default function WorkoutTemplatesView() {
  const navigate = useNavigate()
  const params = useParams()
  const view = params.id ? 'detail' : 'list'
  const workoutId = params.id ? Number(params.id) : null
  const [items, setItems] = useState<WorkoutTemplateListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<WorkoutTemplateListItem | null>(null)
  const [editingItem, setEditingItem] = useState<WorkoutTemplateListItem | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isExclusive, setIsExclusive] = useState(false)
  // Bug real de privacidad (2026-09-18): el catálogo público de la app
  // (Home > Entrenamientos) listaba TODOS los workouts, incluidos los
  // personalizados de un cliente concreto -- ahora nacen privados
  // (is_public=false por defecto en el backend) y el coach marca a mano
  // los que quiere abrir al público, igual que ya hacía con "Exclusivo".
  const [isPublic, setIsPublic] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // AÑADIDO (pedido explícito 2026-09-18): foto de la plantilla -- antes no
  // existía forma de ponerla/cambiarla desde el panel, así que el calendario
  // del cliente (ClientCalendarController::getMyMonth) nunca tenía un
  // thumbnail real y caía siempre en el fallback genérico de stock.
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Detalle: mismo componente y mismos endpoints que "Vista previa del
  // entrenamiento" (WorkoutPreviewModal) - antes esta pagina tenia su
  // propio editor hecho a mano con claves de campo obsoletas
  // (sets/reps_min/reps_max/weight/rest_seconds, que no existen en el
  // catalogo real de metricas) y sin actualizacion optimista.
  const [detail, setDetail] = useState<WorkoutDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [availableExercises, setAvailableExercises] = useState<WorkoutViewerExercise[]>([])
  const [availableLoading, setAvailableLoading] = useState(false)
  const [notesExercise, setNotesExercise] = useState<WorkoutViewerExercise | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [techniqueExercise, setTechniqueExercise] = useState<WorkoutViewerExercise | null>(null)
  const [sections, setSections] = useState<SectionTemplate[]>([])
  const [importSectionDialogOpen, setImportSectionDialogOpen] = useState(false)
  const [importSectionId, setImportSectionId] = useState('')
  // Guardar un bloque como plantilla de sección (inverso de "Importar sección").
  const [saveSectionBlock, setSaveSectionBlock] = useState<WorkoutViewerBlock | null>(null)
  const [saveSectionTitle, setSaveSectionTitle] = useState('')
  const [savingSection, setSavingSection] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      // La búsqueda y los filtros se hacen en cliente (WorkoutTemplatesList);
      // el endpoint devuelve todas las sueltas hasta per_page.
      const res = await api.get('/admin/workout-template-list?per_page=1000')
      setItems(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar las plantillas de entrenamiento')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const fetchDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/admin/workout-template-detail?id=${id}`)
      const payload: WorkoutDetail = res.data?.data || res.data || null
      setDetail(payload)
    } catch {
      toast.error('Error al cargar el detalle de la plantilla de entrenamiento')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const fetchAvailableExercises = useCallback(async (searchTerm: string, filters: ExerciseLibraryFilters = {}) => {
    setAvailableLoading(true)
    try {
      const params = new URLSearchParams({ search: searchTerm, per_page: '500' })
      if (filters.bodypartId) params.set('bodypart_id', String(filters.bodypartId))
      if (filters.equipmentId) params.set('equipment_id', String(filters.equipmentId))
      if (filters.levelId) params.set('level_id', String(filters.levelId))
      if (filters.exerciseType) params.set('exercise_type', filters.exerciseType)
      const res = await api.get(`/admin/exercises?${params.toString()}`)
      const exercisesData: ApiExercise[] = res.data?.data || res.data || []
      setAvailableExercises(exercisesData.map(e => ({
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

  const fetchSections = useCallback(async () => {
    try {
      const res = await api.get('/admin/section-template-list?per_page=500')
      setSections(res.data?.data || res.data || [])
    } catch {
      // best-effort fetch, ignore failures
    }
  }, [])

  const openDetail = (item: WorkoutTemplateListItem) => {
    navigate(`/workout-templates/${item.id}`)
  }

  useEffect(() => {
    if (workoutId === null) { setDetail(null); return }
    setDetail(null)
    fetchDetail(workoutId)
    fetchAvailableExercises('')
    fetchSections()
  }, [workoutId, fetchDetail, fetchAvailableExercises, fetchSections])

  const handleCreateOrUpdate = async () => {
    if (!title.trim()) { toast.error('El título es obligatorio'); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('title', title)
      fd.append('description', description || '')
      fd.append('is_exclusive', isExclusive ? '1' : '0')
      fd.append('is_public', isPublic ? '1' : '0')
      if (image) fd.append('image', image)

      if (editingItem) {
        fd.append('id', String(editingItem.id))
        await api.upload('/admin/workout-template-update', fd)
        toast.success('Plantilla de entrenamiento actualizada')
      } else {
        await api.upload('/admin/workout-template-store', fd)
        toast.success('Plantilla de entrenamiento creada')
      }
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  // Borrado lógico de varias plantillas (selección en la lista por carpetas).
  const handleBulkDelete = async (ids: number[]): Promise<number> => {
    let ok = 0
    for (const id of ids) {
      try {
        await api.post('/admin/workout-template-delete', { id })
        ok++
      } catch { /* se cuenta abajo */ }
    }
    if (ok === ids.length) toast.success(ok === 1 ? 'Plantilla eliminada' : `${ok} plantillas eliminadas`)
    else toast.error(`Se eliminaron ${ok} de ${ids.length} plantillas`)
    fetchItems()
    return ok
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    try {
      await api.post('/admin/workout-template-delete', { id: deletingItem.id })
      toast.success('Eliminado')
      setDeleteDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar')
    }
  }

  // Actualizaciones optimistas en local (sin recargar toda la plantilla en
  // cada edicion de campo) - mismo patron que WorkoutPreviewModal.
  const updateExerciseLocally = (exerciseId: number, patch: Partial<ApiBlockExercise>) => {
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

  const handleUpdateTitle = async (newTitle: string) => {
    if (!detail) return
    const id = detail.id
    setDetail(prev => prev ? { ...prev, title: newTitle } : prev)
    try {
      await api.post('/admin/workout-template-update', { id, title: newTitle })
      toast.success('Nombre actualizado')
      fetchItems()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.data?.message || 'No se pudo renombrar el entrenamiento')
      fetchDetail(id)
    }
  }

  const handleAddBlock = async (blockTitle: string) => {
    if (!detail) return
    try {
      await api.post('/admin/workout-template-block-store', {
        workout_template_id: detail.id,
        title: blockTitle,
      })
      toast.success('Bloque añadido')
      fetchDetail(detail.id)
    } catch (err: any) {
      toast.error(err?.message || 'Error al añadir el bloque')
    }
  }

  const handleRenameBlock = async (blockId: number, blockTitle: string) => {
    updateBlockLocally(blockId, { title: blockTitle })
    try {
      await api.post('/admin/workout-template-block-update', { id: blockId, title: blockTitle })
    } catch (err: any) {
      toast.error(err?.message || 'Error al renombrar el bloque')
    }
  }

  const handleRemoveBlock = async (blockId: number) => {
    if (!detail) return
    try {
      await api.post('/admin/workout-template-block-delete', { id: blockId })
      toast.success('Bloque eliminado')
      fetchDetail(detail.id)
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar el bloque')
    }
  }

  const handleUpdateBlockInstructions = async (blockId: number, value: string) => {
    updateBlockLocally(blockId, { instructions: value || null })
    try {
      await api.post('/admin/workout-template-block-instructions', { id: blockId, instructions: value || null })
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar')
    }
  }

  const handleImportSection = async () => {
    if (!detail || !importSectionId) return
    try {
      await api.post('/admin/workout-template-import-section', {
        workout_template_id: detail.id,
        section_template_id: Number(importSectionId)
      })
      toast.success('Sección importada')
      setImportSectionDialogOpen(false)
      setImportSectionId('')
      fetchDetail(detail.id)
    } catch (err: any) {
      toast.error(err?.message || 'Error al importar la sección')
    }
  }

  const openSaveAsSection = (block: WorkoutViewerBlock) => {
    setSaveSectionBlock(block)
    setSaveSectionTitle(block.title || '')
  }

  const handleSaveAsSection = async () => {
    if (!saveSectionBlock) return
    setSavingSection(true)
    try {
      const res = await api.post('/admin/workout-template-block-save-as-section', {
        id: saveSectionBlock.id,
        title: saveSectionTitle.trim() || null,
      })
      const sectionId = res?.data?.data?.id ?? res?.data?.id
      setSaveSectionBlock(null)
      toast.success('Bloque guardado como plantilla de sección', {
        action: { label: 'Ver secciones', onClick: () => navigate(sectionId ? `/section-templates/${sectionId}` : '/section-templates') },
      })
      fetchSections()
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar el bloque como sección')
    } finally {
      setSavingSection(false)
    }
  }

  const handleAddExercise = async (blockId: number, exercise: WorkoutViewerExercise) => {
    try {
      // Sin prescribed/enabled_metrics por defecto: el coach los rellena
      // el mismo desde la tabla, usando el catalogo real de metricas.
      await api.post('/admin/workout-template-exercise-save', {
        workout_template_block_id: blockId,
        exercise_id: exercise.id,
        prescribed: {},
        enabled_metrics: [],
      })
      toast.success('Ejercicio añadido')
      if (detail) fetchDetail(detail.id)
    } catch (err: any) {
      toast.error(err?.message || 'Error al añadir el ejercicio')
    }
  }

  const handleRemoveExercise = async (blockId: number, exerciseId: number) => {
    if (!detail) return
    try {
      await api.post('/admin/workout-template-exercise-delete', { id: exerciseId })
      toast.success('Ejercicio eliminado')
      fetchDetail(detail.id)
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar el ejercicio')
    }
  }

  const handleUpdateField = async (exercise: WorkoutViewerExercise, blockId: number, field: string, value: string) => {
    updateExerciseLocally(exercise.id, { prescribed: { ...exercise.prescribed, [field]: value || null } })
    try {
      await api.post('/admin/workout-template-exercise-update-field', {
        id: exercise.id,
        field,
        value: value || null
      })
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar')
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
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar las métricas')
    }
  }

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
      await api.post('/admin/workout-template-exercise-notes', { id: notesExercise.id, notes: notesValue || null })
      toast.success('Notas guardadas')
      setNotesExercise(null)
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar las notas')
    }
  }

  const blocks: WorkoutViewerBlock[] = (detail?.blocks ?? []).map(b => ({
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
    })),
  }))

  if (view === 'detail') {
    return (
      <Card className='h-[calc(100vh-140px)] flex flex-col'>
        <CardHeader className='flex flex-row items-center gap-3 shrink-0'>
          <Button variant='ghost' size='sm' className='shrink-0' onClick={() => navigate('/workout-templates')}>
            <ArrowLeftIcon className='size-4 mr-1' /> Volver
          </Button>
          <CardTitle className='truncate min-w-0'>{detail?.title || 'Plantilla de entrenamiento'}</CardTitle>
        </CardHeader>
        <CardContent className='flex-1 min-h-0 overflow-hidden'>
          {detailLoading ? (
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
              onSaveBlockAsSection={openSaveAsSection}
              onUpdateBlockInstructions={handleUpdateBlockInstructions}
              onAddExercise={handleAddExercise}
              onRemoveExercise={handleRemoveExercise}
              onUpdateExerciseField={handleUpdateField}
              onUpdateExerciseMetrics={handleUpdateMetrics}
              onExerciseNotes={handleOpenNotes}
              onExerciseTechnique={ex => setTechniqueExercise(ex)}
              onSearchExercises={fetchAvailableExercises}
              headerExtras={
                <Button variant='outline' size='sm' className='h-8 text-xs' onClick={() => { fetchSections(); setImportSectionDialogOpen(true) }}>
                  <DownloadIcon className='size-3 mr-1' /> Importar sección
                </Button>
              }
            />
          )}
        </CardContent>

        <ExerciseTechniqueDialog
          exercise={techniqueExercise}
          description='Se guarda en la plantilla: afecta a todos los que la usen.'
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

        <Dialog open={!!saveSectionBlock} onOpenChange={open => { if (!open) setSaveSectionBlock(null) }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Guardar bloque como plantilla de sección</DialogTitle></DialogHeader>
            <p className='text-sm text-muted-foreground'>
              Se copiará el bloque (instrucciones y {saveSectionBlock?.exercises.length ?? 0} ejercicios con su prescripción y métricas)
              a Plantillas de secciones para reutilizarlo en otros entrenamientos. Es una copia: editar uno no cambia el otro.
              Las notas por ejercicio no se copian.
            </p>
            <Field className='gap-2'>
              <FieldLabel>Nombre de la sección</FieldLabel>
              <Input value={saveSectionTitle} onChange={e => setSaveSectionTitle(e.target.value)} placeholder='Nombre de la sección' />
            </Field>
            <DialogFooter>
              <Button variant='outline' onClick={() => setSaveSectionBlock(null)} disabled={savingSection}>Cancelar</Button>
              <Button onClick={handleSaveAsSection} disabled={savingSection || !saveSectionTitle.trim()}>
                {savingSection ? 'Guardando...' : 'Guardar sección'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importSectionDialogOpen} onOpenChange={setImportSectionDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Importar sección</DialogTitle></DialogHeader>
            <p className='text-sm text-muted-foreground'>Esto clonará todos los ejercicios de una sección en esta plantilla de entrenamiento.</p>
            <Field className='gap-2'>
              <FieldLabel>Sección</FieldLabel>
              <Select value={importSectionId} onValueChange={v => setImportSectionId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Seleccionar sección' /></SelectTrigger>
                <SelectContent>
                  {sections.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter>
              <Button variant='outline' onClick={() => setImportSectionDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleImportSection} disabled={!importSectionId}>Importar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    )
  }

  return (
    <>
      <WorkoutTemplatesList
        items={items}
        loading={loading}
        onOpen={openDetail}
        onEdit={item => {
          setEditingItem(item); setTitle(item.title); setDescription(item.description || ''); setIsExclusive(!!item.is_exclusive); setIsPublic(!!item.is_public)
          setImage(null); setImagePreview(item.thumbnail || null)
          setDialogOpen(true)
        }}
        onDelete={item => { setDeletingItem(item); setDeleteDialogOpen(true) }}
        onCreate={() => { setEditingItem(null); setTitle(''); setDescription(''); setIsExclusive(false); setIsPublic(false); setImage(null); setImagePreview(null); setDialogOpen(true) }}
        onBulkDelete={handleBulkDelete}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar plantilla de entrenamiento' : 'Nueva plantilla de entrenamiento'}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Foto (se muestra en el calendario del cliente)</FieldLabel>
              <label className='block w-fit'>
                <input
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) { setImage(file); setImagePreview(URL.createObjectURL(file)) }
                  }}
                />
                <div className='w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer overflow-hidden transition-colors flex items-center justify-center bg-muted/20'>
                  {imagePreview ? (
                    <img src={imagePreview} alt='Vista previa' className='w-full h-full object-cover' />
                  ) : (
                    <div className='flex flex-col items-center gap-1 text-muted-foreground'>
                      <ImageIcon className='size-5' />
                      <span className='text-[10px]'>Elegir imagen</span>
                    </div>
                  )}
                </div>
              </label>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Título</FieldLabel>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder='Título de la plantilla' />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Descripción</FieldLabel>
              <textarea
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2'
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder='Descripción opcional'
              />
            </Field>
            <Field className='flex-row items-center justify-between gap-2'>
              <FieldLabel>Exclusivo (solo para programas, requiere un paquete con acceso completo a entrenamientos)</FieldLabel>
              <Switch checked={isExclusive} onCheckedChange={setIsExclusive} />
            </Field>
            <Field className='flex-row items-center justify-between gap-2'>
              <FieldLabel>Público (visible para todos los clientes en Inicio y el catálogo de Entrenamientos de la app; desactivado por defecto)</FieldLabel>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateOrUpdate} disabled={submitting}>
              {submitting ? 'Guardando...' : editingItem ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar plantilla</DialogTitle></DialogHeader>
          <p>¿Seguro? Esto eliminará todos los bloques y ejercicios de esta plantilla.</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
