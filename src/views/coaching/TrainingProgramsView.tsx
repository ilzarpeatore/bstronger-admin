import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import {
  PlusIcon,
  TrashIcon,
  ArrowLeftIcon,
  RefreshCwIcon,
  PencilIcon,
  UsersIcon,
  EyeIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  SearchIcon,
  SparklesIcon,
  DumbbellIcon,
  MoonIcon,
  UploadIcon,
  FileSpreadsheetIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
} from 'lucide-react'

import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import type { TrainingProgram, ProgramClientAssignment, Workout, User } from '@/types'
import WorkoutPreviewModal from '@/components/coaching/WorkoutPreviewModal'

export default function TrainingProgramsView() {
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const programId = params.id ? Number(params.id) : null
  const view = programId ? 'detail' : 'list'
  const isAssignDayOpen = params.mode !== undefined
  const assignDayMode: 'select' | 'create' | 'ai' =
    params.mode === 'create' || params.mode === 'ai' ? params.mode : 'select'
  const assignDayData: { week: number; day: number } | null =
    isAssignDayOpen && searchParams.get('week') && searchParams.get('day')
      ? { week: Number(searchParams.get('week')), day: Number(searchParams.get('day')) }
      : null

  const [items, setItems] = useState<TrainingProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Importación de programa desde Excel (formato de
  // AgenticdesignBS/agentes/programacion-entrenamiento/formato-salida/formato-excel.md,
  // idéntico a database/data/programs/EXCEL_FORMAT.md en Bckbs).
  // POST /admin/program-import — dry_run=true primero (preview + review_required),
  // el coach confirma, dry_run=false importa de verdad. Nunca asigna a un cliente:
  // eso sigue siendo manual desde "Asignar clientes", igual que documenta
  // docs/AGENTE_IMPORTADOR.md (Bckbs).
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importAnalyzing, setImportAnalyzing] = useState(false)
  const [importImporting, setImportImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any | null>(null)
  const [importDone, setImportDone] = useState<any | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [workoutTemplates, setWorkoutTemplates] = useState<Workout[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [selected, setSelected] = useState<TrainingProgram | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [createEditOpen, setCreateEditOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<TrainingProgram | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formWorkoutId, setFormWorkoutId] = useState('')
  const [formNumWeeks, setFormNumWeeks] = useState('4')
  const [formStartDate, setFormStartDate] = useState('')

  const [formAutoGenerate, setFormAutoGenerate] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<TrainingProgram | null>(null)

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assigningProgram, setAssigningProgram] = useState<TrainingProgram | null>(null)
  const [assignments, setAssignments] = useState<ProgramClientAssignment[]>([])
  const [assignClientId, setAssignClientId] = useState('')
  const [assignStartDate, setAssignStartDate] = useState('')
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  const [calendarWeeks, setCalendarWeeks] = useState<any[]>([])
  const [calStartWeek, setCalStartWeek] = useState(1)
  const [calTotalWeeks, setCalTotalWeeks] = useState(0)
  const [calWeeksPerPage, setCalWeeksPerPage] = useState(4)
  const [assignDayTemplateId, setAssignDayTemplateId] = useState('')
  const [templateSearch, setTemplateSearch] = useState('')
  const [createTitle, setCreateTitle] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createImage, setCreateImage] = useState<File | null>(null)
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [aiName, setAiName] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiCreating, setAiCreating] = useState(false)

  const [clipboardAssignment, setClipboardAssignment] = useState<{ assignment_id: number; workout_title: string } | null>(null)
  const [draggedAssignmentId, setDraggedAssignmentId] = useState<number | null>(null)
  const [previewTemplateId, setPreviewTemplateId] = useState<number | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams({ per_page: '100' })

      if (search) params.set('search', search)
      const res = await api.get(`/admin/training-program-list?${params}`)

      setItems(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar los programas de entrenamiento')
    } finally {
      setLoading(false)
    }
  }, [search])

  const fetchOptions = useCallback(async () => {
    try {
      const [templatesRes, usersRes] = await Promise.all([
        api.get('/admin/workout-template-list?per_page=500'),
        api.get('/admin/users?per_page=500'),
      ])
      setWorkoutTemplates(templatesRes.data?.data || templatesRes.data || [])
      setUsers(usersRes.data || usersRes.data?.data || [])
    } catch {
      toast.error('Error al cargar las opciones')
    }
  }, [])

  const fetchWorkouts = useCallback(async () => {
    try {
      const res = await api.get('/admin/workouts?per_page=500')
      setWorkouts(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar los entrenamientos')
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    if (createEditOpen) {
      fetchWorkouts()
    }
  }, [createEditOpen, fetchWorkouts])

  useEffect(() => {
    if (programId !== null) {
      fetchOptions()
    }
  }, [programId, fetchOptions])

  const openCreateDialog = () => {
    setEditingProgram(null)
    setFormTitle('')
    setFormWorkoutId('')
    setFormNumWeeks('4')
    setFormStartDate('')
    setFormAutoGenerate(false)

    setCreateEditOpen(true)
  }

  const openEditDialog = (program: TrainingProgram) => {
    setEditingProgram(program)
    setFormTitle(program.title || '')
    setFormWorkoutId(program.workout_id ? String(program.workout_id) : '')
    setFormNumWeeks(String(program.num_weeks))
    setFormStartDate(program.start_date || '')
    setFormAutoGenerate(false)

    setCreateEditOpen(true)
  }

  const handleSaveCreateEdit = async () => {
    if (!formWorkoutId) {
      toast.error('El entrenamiento es obligatorio')

      return
    }

    setSubmitting(true)

    try {
      if (editingProgram) {
        await api.post('/admin/training-program-update', {
          id: editingProgram.id,
          title: formTitle || null,
          workout_id: Number(formWorkoutId),
          num_weeks: Number(formNumWeeks),
          fecha_inicio: formStartDate || null,
        })

        toast.success('Programa de entrenamiento actualizado')
      } else {
        await api.post('/admin/training-program-store', {
          title: formTitle || null,
          workout_id: Number(formWorkoutId),
          num_weeks: Number(formNumWeeks),
          fecha_inicio: formStartDate || new Date().toISOString().split('T')[0],
          auto_generate: formAutoGenerate,
        })

        toast.success('Programa de entrenamiento creado')
      }

      setCreateEditOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteDialog = (program: TrainingProgram) => {
    setDeletingItem(program)

    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingItem) return

    try {
      await api.post('/admin/training-program-delete', { id: deletingItem.id })

      toast.success('Programa de entrenamiento eliminado')
      setDeleteDialogOpen(false)
      setDeletingItem(null)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al eliminar')
    }
  }

  const openImportDialog = () => {
    setImportFile(null)
    setImportPreview(null)
    setImportDone(null)
    setImportError(null)
    setImportAnalyzing(false)
    setImportImporting(false)
    setImportDialogOpen(true)
  }

  const handleImportFileChange = (file: File | null) => {
    setImportFile(file)
    setImportPreview(null)
    setImportDone(null)
    setImportError(null)
  }

  const handleAnalyzeImport = async () => {
    if (!importFile) return
    setImportAnalyzing(true)
    setImportError(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('dry_run', 'true')
      const res: any = await api.upload('/admin/program-import', fd)
      if (res?.ok === false) {
        setImportError(res.error || 'El archivo no se pudo analizar')
      } else {
        setImportPreview(res)
      }
    } catch (err: any) {
      setImportError(err?.data?.error || err?.response?.data?.message || err?.message || 'Error al analizar el archivo')
    } finally {
      setImportAnalyzing(false)
    }
  }

  const handleConfirmImport = async (force = false) => {
    if (!importFile) return
    setImportImporting(true)
    setImportError(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('dry_run', 'false')
      if (force) fd.append('force', 'true')
      const res: any = await api.upload('/admin/program-import', fd)
      if (res?.ok === false) {
        setImportError(res.error || 'No se pudo importar el programa')
      } else {
        setImportDone(res)
        toast.success('Programa importado a la biblioteca')
        fetchItems()
      }
    } catch (err: any) {
      setImportError(err?.data?.error || err?.response?.data?.message || err?.message || 'Error al importar el programa')
    } finally {
      setImportImporting(false)
    }
  }

  const importIsDuplicate = !!importError && /existe|duplicad/i.test(importError)

  const reloadDetail = useCallback(async (id: number) => {
    const res = await api.get(`/admin/training-program-detail?id=${id}`)
    const detail = res.data?.data || res.data
    setSelected(detail)
  }, [])

  const openDetail = (program: TrainingProgram) => {
    navigate(`/training-programs/${program.id}`)
  }

  useEffect(() => {
    if (programId === null) {
      setSelected(null)
      setCalendarWeeks([])
      setDetailLoading(false)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    reloadDetail(programId)
      .then(() => { if (!cancelled) setDetailLoading(false) })
      .catch(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [programId, reloadDetail])

  const handleGenerateWeeks = async () => {
    if (!selected) return

    try {
      const res = await api.post('/admin/training-program-generate-weeks', { id: selected.id })

      toast.success(res.data?.message || res.message || 'Semanas generadas')
      await reloadDetail(selected.id)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al generar las semanas')
    }
  }

  const openAssignDialog = async (program: TrainingProgram) => {
    setAssigningProgram(program)
    setAssignClientId('')
    setAssignStartDate('')

    setAssignDialogOpen(true)
    await fetchAssignments(program.id)
  }

  const fetchAssignments = async (programId: number) => {
    setLoadingAssignments(true)

    try {
      const res = await api.get(`/admin/training-program-assignments?training_program_id=${programId}`)

      setAssignments(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar las asignaciones')
    } finally {
      setLoadingAssignments(false)
    }
  }

  const handleAssignClient = async () => {
    if (!assigningProgram || !assignClientId) {
      toast.error('Selecciona un cliente')

      return
    }

    try {
      await api.post('/admin/training-program-assign-client', {
        training_program_id: assigningProgram.id,
        client_id: Number(assignClientId),
        start_date: assignStartDate || new Date().toISOString().split('T')[0],
      })

      toast.success('Cliente asignado')
      setAssignClientId('')
      setAssignStartDate('')
      fetchAssignments(assigningProgram.id)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al asignar el cliente')
    }
  }

  const handleRemoveAssignment = async (assignmentId: number) => {
    // FIX (auditoría 2026-09-13): sin confirmación -- desasignaba al
    // cliente del programa con un solo clic (la vista ya usa confirm() en
    // "vaciar semana", mismo criterio aquí).
    if (!confirm('¿Quitar a este cliente del programa de entrenamiento?')) return
    try {
      await api.post('/admin/training-program-remove-assignment', { id: assignmentId })

      toast.success('Asignación eliminada')

      if (assigningProgram) {
        fetchAssignments(assigningProgram.id)
      }

      fetchItems()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al eliminar la asignación')
    }
  }

  const getWorkoutTitle = (program: TrainingProgram) => {
    return program.workout?.title || '—'
  }

  const getClientAssignmentCount = (program: TrainingProgram) => {
    return program.client_assignments?.length ?? 0
  }

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'default'
      case 'completed':
        return 'secondary'
      case 'inactive':
        return 'outline'
      case 'draft':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getUserName = (user?: User) => {
    if (!user) return '—'
    if (user.display_name) return user.display_name

    return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
  }

  const fetchCalendar = useCallback(async () => {
    if (!selected) return
    try {
      const res = await api.get(`/admin/real-calendar-weeks-grid?training_program_id=${selected.id}&start_week=${calStartWeek}&weeks_per_page=${calWeeksPerPage}`)
      const d = res.data?.data || res.data
      setCalendarWeeks(d?.weeks || [])
      setCalTotalWeeks(d?.num_weeks || selected.num_weeks || 0)
    } catch {
      toast.error('Error al cargar el calendario')
    }
  }, [selected, calStartWeek, calWeeksPerPage])

  useEffect(() => { if (programId !== null && selected) fetchCalendar() }, [programId, selected, fetchCalendar])

  const openAssignDay = (week: number, day: number) => {
    navigate(`/training-programs/${programId}/asignar-dia/select?week=${week}&day=${day}`)
  }

  useEffect(() => {
    if (isAssignDayOpen) {
      setAssignDayTemplateId('')
      setTemplateSearch('')
      setCreateTitle('')
      setCreateDescription('')
      setCreateImage(null)
      setCreateImagePreview(null)
      setAiName('')
      setAiPrompt('')
    }
  }, [isAssignDayOpen])

  const handleAssignDay = async () => {
    if (!selected || !assignDayData || !assignDayTemplateId) return
    try {
      await api.post('/admin/real-calendar-assign-week-day', {
        training_program_id: selected.id,
        week_number: assignDayData.week,
        day_of_week: assignDayData.day,
        workout_template_id: Number(assignDayTemplateId),
      })
      toast.success('Entrenamiento asignado')
      navigate(`/training-programs/${programId}`)
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al asignar')
    }
  }

  const handleCreateAndAssign = async () => {
    if (!createTitle.trim()) { toast.error('El título es obligatorio'); return }
    setCreateSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('title', createTitle.trim())
      if (createDescription.trim()) fd.append('description', createDescription.trim())
      if (createImage) fd.append('image', createImage)
      const res = await api.upload('/admin/workout-template-store', fd)
      const newTemplate = res.data?.data || res.data
      toast.success('Plantilla creada')
      setAssignDayTemplateId(String(newTemplate.id))
      fetchOptions()
      handleAssignDay()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al crear la plantilla')
    } finally {
      setCreateSubmitting(false)
    }
  }

  const handleAiGenerate = async () => {
    if (!aiName.trim()) { toast.error('El nombre del entrenamiento es obligatorio'); return }
    setAiCreating(true)
    try {
      const res = await api.post('/admin/workout-template-store', {
        title: aiName.trim(),
        description: aiPrompt.trim() || null,
      })
      const newTemplate = res.data?.data || res.data
      toast.success('Plantilla generada')
      setAssignDayTemplateId(String(newTemplate.id))
      fetchOptions()
      handleAssignDay()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al generar')
    } finally {
      setAiCreating(false)
    }
  }

  const handleRemoveDayAssignment = async (assignmentId: number) => {
    try {
      await api.post('/admin/real-calendar-remove', { assignment_id: assignmentId })
      toast.success('Eliminado')
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar')
    }
  }

  const handleSwapWeeks = async (weekA: number, weekB: number) => {
    if (!selected) return
    try {
      const res: any = await api.post('/admin/real-calendar-swap-weeks', { training_program_id: selected.id, week_a: weekA, week_b: weekB })
      toast.success(res.message || 'Semanas intercambiadas')
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error')
    }
  }

  const handleDuplicateWeek = async (sourceWeek: number, targetWeek: number) => {
    if (!selected) return
    try {
      const res: any = await api.post('/admin/real-calendar-duplicate-week', { training_program_id: selected.id, source_week: sourceWeek, target_week: targetWeek })
      toast.success(res.message || 'Semana duplicada')
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error')
    }
  }

  const handleClearWeek = async (weekNumber: number) => {
    if (!selected) return
    try {
      const res: any = await api.post('/admin/real-calendar-clear-week', { training_program_id: selected.id, week_number: weekNumber })
      toast.success(res.message || 'Semana vaciada')
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error')
    }
  }

  const [togglingDeloadWeek, setTogglingDeloadWeek] = useState<number | null>(null)
  const handleToggleDeload = async (week: any) => {
    if (!selected) return
    setTogglingDeloadWeek(week.week_number)
    try {
      await api.post('/admin/training-program-mark-week-deload', { training_program_id: selected.id, week_number: week.week_number, is_deload: !week.is_deload })
      toast.success(!week.is_deload ? 'Semana marcada como descarga' : 'Semana desmarcada como descarga')
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al actualizar la semana')
    } finally {
      setTogglingDeloadWeek(null)
    }
  }

  const handleCopyAssignment = (assignmentId: number, title: string) => {
    setClipboardAssignment({ assignment_id: assignmentId, workout_title: title })
    toast.info('Entrenamiento copiado — haz clic en una celda del día para pegar')
  }

  const handlePasteAssignment = async (weekNumber: number, dayOfWeek: number) => {
    if (!clipboardAssignment || !selected) return
    try {
      await api.post('/admin/real-calendar-duplicate-week-day', {
        assignment_id: clipboardAssignment.assignment_id,
        new_week_number: weekNumber,
        new_day_of_week: dayOfWeek,
      })
      toast.success('Entrenamiento pegado')
      setClipboardAssignment(null)
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al pegar')
    }
  }

  const handleDragStart = (e: React.DragEvent, assignmentId: number) => {
    setDraggedAssignmentId(assignmentId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(assignmentId))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, weekNumber: number, dayOfWeek: number) => {
    e.preventDefault()
    if (!draggedAssignmentId || !selected) return
    try {
      await api.post('/admin/real-calendar-move-week-day', {
        assignment_id: draggedAssignmentId,
        new_week_number: weekNumber,
        new_day_of_week: dayOfWeek,
      })
      toast.success('Entrenamiento movido')
      setDraggedAssignmentId(null)
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al mover')
      setDraggedAssignmentId(null)
    }
  }

  const handleOpenPreview = (templateId: number) => {
    setPreviewTemplateId(templateId)
    setPreviewOpen(true)
  }

  const assignedClientIds = useMemo(() => new Set(assignments.map((a) => a.client_id)), [assignments])
  const availableUsers = useMemo(() => users.filter((u) => !assignedClientIds.has(u.id)), [users, assignedClientIds])

  if (view === 'detail') {
    if (detailLoading || !selected) {
      return (
        <Card>
          <CardContent className='flex items-center justify-center h-[300px]'>
            <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
          </CardContent>
        </Card>
      )
    }
    return (
      <>
      <Card>
        <CardHeader className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex flex-wrap items-center gap-3'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => navigate('/training-programs')}
            >
              <ArrowLeftIcon className='size-4 mr-1' /> Volver
            </Button>
            <CardTitle>{selected.title || `Programa #${selected.id}`}</CardTitle>
            <Badge variant={getStatusVariant(selected.status)}>
              {selected.status || 'Activo'}
            </Badge>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' className='flex-1 sm:flex-initial' onClick={() => openAssignDialog(selected)}>
              <UsersIcon className='size-4 mr-2' /> Asignar clientes
            </Button>
            <Button className='flex-1 sm:flex-initial' onClick={handleGenerateWeeks}>
              <RefreshCwIcon className='size-4 mr-2' /> Generar semanas
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div>
              <p className='text-sm text-muted-foreground'>Entrenamiento</p>
              <p className='font-medium'>{getWorkoutTitle(selected)}</p>
            </div>
            <div>
              <p className='text-sm text-muted-foreground'>Fecha de inicio</p>
              <p className='font-medium'>{selected.start_date || '—'}</p>
            </div>
            <div>
              <p className='text-sm text-muted-foreground'>Semanas</p>
              <p className='font-medium'>{selected.num_weeks}</p>
            </div>
            <div>
              <p className='text-sm text-muted-foreground'>Clientes asignados</p>
              <p className='font-medium'>{getClientAssignmentCount(selected)}</p>
            </div>
          </div>

          <div>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3'>
              <div className='flex flex-wrap items-center gap-3'>
                <h3 className='text-sm font-medium text-muted-foreground'>Calendario del programa</h3>
                {clipboardAssignment && (
                  <span className='text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1'>
                    <CopyIcon className='size-3' /> Copiado — haz clic en un día para pegar
                  </span>
                )}
              </div>
              <div className='flex items-center gap-2'>
                <Button variant='outline' size='sm' onClick={() => setCalWeeksPerPage(calWeeksPerPage === 4 ? 5 : 4)}>
                  {calWeeksPerPage} semanas
                </Button>
                <div className='flex items-center rounded-md border'>
                  <Button
                    variant='ghost' size='sm' className='rounded-r-none h-8 px-2'
                    disabled={calStartWeek <= 1}
                    onClick={() => setCalStartWeek(Math.max(1, calStartWeek - calWeeksPerPage))}
                  >
                    <ChevronLeftIcon className='size-3' />
                  </Button>
                  <span className='text-xs text-muted-foreground px-2 h-8 flex items-center border-x'>
                    Mes {Math.ceil(calStartWeek / calWeeksPerPage)} de {Math.ceil(calTotalWeeks / calWeeksPerPage)}
                  </span>
                  <Button
                    variant='ghost' size='sm' className='rounded-l-none h-8 px-2'
                    disabled={calStartWeek + calWeeksPerPage > calTotalWeeks}
                    onClick={() => setCalStartWeek(calStartWeek + calWeeksPerPage)}
                  >
                    <ChevronRightIcon className='size-3' />
                  </Button>
                </div>
              </div>
            </div>

            {calendarWeeks.length === 0 ? (
              <div className='rounded-lg border border-dashed p-12 text-center'>
                <DumbbellIcon className='size-10 mx-auto text-muted-foreground/40 mb-3' />
                <p className='text-sm text-muted-foreground'>Aún no se han generado semanas.</p>
                <Button size='sm' className='mt-3' onClick={handleGenerateWeeks}>
                  <RefreshCwIcon className='size-3 mr-1' /> Generar semanas
                </Button>
              </div>
            ) : (
              <div className='space-y-4'>
                {calendarWeeks.map(week => {
                  let dayCounter = (week.week_number - 1) * 7
                  return (
                    <div key={week.week_number} className={`rounded-lg border bg-card ${week.is_deload ? 'border-amber-400/60' : ''}`}>
                      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${week.is_deload ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                        <div className='flex items-center gap-2'>
                          <span className='text-sm font-semibold'>Semana {week.week_number}</span>
                          {week.is_deload && (
                            <Badge variant='outline' className='gap-1 text-amber-700 dark:text-amber-400 border-amber-400/60'>
                              <MoonIcon className='size-3' /> Descarga
                            </Badge>
                          )}
                        </div>
                        <div className='flex items-center gap-1'>
                          <div className='flex items-center gap-1.5 mr-1' title='Marcar semana de descarga'>
                            <MoonIcon className='size-3 text-muted-foreground' />
                            <Switch
                              checked={!!week.is_deload}
                              disabled={togglingDeloadWeek === week.week_number}
                              onCheckedChange={() => handleToggleDeload(week)}
                            />
                          </div>
                          {week.week_number > 1 && (
                            <Button variant='ghost' size='sm' className='h-6 text-[10px] gap-1' onClick={() => handleSwapWeeks(week.week_number, week.week_number - 1)}>
                              <ChevronLeftIcon className='size-3' /> Subir
                            </Button>
                          )}
                          {week.week_number < calTotalWeeks && (
                            <Button variant='ghost' size='sm' className='h-6 text-[10px] gap-1' onClick={() => handleSwapWeeks(week.week_number, week.week_number + 1)}>
                              Bajar <ChevronRightIcon className='size-3' />
                            </Button>
                          )}
                          <Button variant='ghost' size='sm' className='h-6 text-[10px]' onClick={() => {
                            const target = prompt(`¿Duplicar la semana ${week.week_number} en qué semana? (1-${calTotalWeeks})`)
                            if (target) handleDuplicateWeek(week.week_number, Number(target))
                          }}>
                            <CopyIcon className='size-3 mr-0.5' /> Copiar
                          </Button>
                          <Button variant='ghost' size='sm' className='h-6 text-[10px] text-destructive' onClick={() => {
                            if (confirm(`¿Vaciar todos los entrenamientos de la semana ${week.week_number}?`)) handleClearWeek(week.week_number)
                          }}>
                            Vaciar
                          </Button>
                        </div>
                      </div>

                      <div className='overflow-x-auto'>
                      <div className='grid grid-cols-7 divide-x min-w-[700px]'>
                        {week.days.map((day: any) => {
                          dayCounter++
                          const workout = day.workouts?.[0]
                          return (
                            <div
                              key={day.day_of_week}
                              className={`p-2 min-h-[160px] flex flex-col ${clipboardAssignment ? 'hover:bg-primary/5 cursor-pointer' : ''}`}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, week.week_number, day.day_of_week)}
                              onClick={() => { if (clipboardAssignment) handlePasteAssignment(week.week_number, day.day_of_week) }}
                            >
                              <p className='text-[11px] font-medium text-muted-foreground mb-2'>Día {dayCounter}</p>
                              {workout ? (
                                <div
                                  className='group rounded-lg border bg-card shadow-sm overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex-1'
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, workout.assignment_id)}
                                >
                                  {workout.thumbnail ? (
                                    <div className='h-20 w-full overflow-hidden bg-muted'>
                                      <img src={workout.thumbnail} alt='' loading='lazy' decoding='async' className='w-full h-full object-cover' />
                                    </div>
                                  ) : (
                                    <div className='h-20 w-full bg-muted flex items-center justify-center'>
                                      <DumbbellIcon className='size-6 text-muted-foreground/30' />
                                    </div>
                                  )}

                                  <div className='px-2.5 py-2'>
                                    <div className='flex items-start justify-between gap-1'>
                                      <span
                                        className='text-xs font-semibold leading-tight cursor-pointer hover:underline line-clamp-2'
                                        title={workout.title}
                                        onClick={(e) => { e.stopPropagation(); handleOpenPreview(workout.id) }}
                                      >
                                        {workout.title}
                                      </span>
                                      <div className='flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0'>
                                        <button
                                          className='hover:text-blue-500 p-0.5'
                                          title='Copiar'
                                          onClick={(e) => { e.stopPropagation(); handleCopyAssignment(workout.assignment_id, workout.title) }}
                                        >
                                          <CopyIcon className='size-3' />
                                        </button>
                                        <button
                                          className='hover:text-destructive p-0.5'
                                          title='Eliminar'
                                          onClick={(e) => { e.stopPropagation(); handleRemoveDayAssignment(workout.assignment_id) }}
                                        >
                                          <XIcon className='size-3' />
                                        </button>
                                      </div>
                                    </div>
                                    {workout.exercise_count !== undefined && (
                                      <p className='text-[10px] text-muted-foreground mt-1'>
                                        {workout.exercise_count} Ejercicio{workout.exercise_count !== 1 ? 's' : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className='flex-1 rounded-lg border border-dashed hover:border-primary/50 hover:bg-muted/50 transition-colors flex items-center justify-center text-muted-foreground hover:text-primary'
                                  onClick={() => openAssignDay(week.week_number, day.day_of_week)}
                                >
                                  <PlusIcon className='size-4' />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </CardContent>

        <Dialog
          open={isAssignDayOpen}
          onOpenChange={(open) => { if (!open) navigate(`/training-programs/${programId}`) }}
        >
          <DialogContent className='w-[95vw] sm:w-[740px] h-[90vh] sm:h-[580px] flex flex-col overflow-hidden p-0'>
            <div className='flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b bg-muted/30'>
              <div className='flex items-center gap-2.5'>
                <div className='flex items-center justify-center size-8 rounded-lg bg-primary/10'>
                  <DumbbellIcon className='size-4 text-primary' />
                </div>
                <span className='text-sm font-semibold'>Añadir entrenamiento</span>
              </div>
            </div>

            <Tabs
              value={assignDayMode}
              onValueChange={(v) => {
                if (!v) return
                navigate(`/training-programs/${programId}/asignar-dia/${v}?week=${assignDayData?.week ?? 1}&day=${assignDayData?.day ?? 1}`)
              }}
              className='flex-1 flex flex-col overflow-hidden px-4 pt-3 sm:px-6'
            >
              <TabsList className='w-full justify-start gap-0 mb-0 rounded-b-none border-b bg-transparent h-auto p-0 overflow-x-auto'>
                <TabsTrigger value='create' className='text-xs px-3 sm:px-4 py-2.5 rounded-none border-b-2 border-transparent data-[active]:border-primary whitespace-nowrap'>Nuevo entrenamiento</TabsTrigger>
                <TabsTrigger value='select' className='text-xs px-3 sm:px-4 py-2.5 rounded-none border-b-2 border-transparent data-[active]:border-primary whitespace-nowrap'>Biblioteca de entrenamientos</TabsTrigger>
                <TabsTrigger value='ai' className='text-xs px-3 sm:px-4 py-2.5 rounded-none border-b-2 border-transparent data-[active]:border-primary gap-1.5 whitespace-nowrap'>
                  Entrenador IA <SparklesIcon className='size-3 text-amber-500' />
                </TabsTrigger>
              </TabsList>

              <TabsContent value='create' className='flex-1 overflow-y-auto mt-0 pt-4 space-y-4'>
                <div className='flex flex-col-reverse sm:flex-row gap-4'>
                  <div className='flex-1 space-y-3'>
                    <div className='space-y-1.5'>
                      <label className='text-sm font-medium'>
                        Nombre del entrenamiento<span className='text-destructive ml-0.5'>*</span>
                      </label>
                      <Input
                        placeholder='Nombre del entrenamiento, p. ej. Pecho'
                        value={createTitle}
                        onChange={(e) => setCreateTitle(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <label className='text-sm font-medium'>Descripción del entrenamiento</label>
                      <textarea
                        className='flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none'
                        placeholder='Añade información adicional'
                        rows={3}
                        value={createDescription}
                        onChange={(e) => setCreateDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <label className='block'>
                      <input
                        type='file'
                        accept='image/*'
                        className='hidden'
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setCreateImage(file)
                            setCreateImagePreview(URL.createObjectURL(file))
                          }
                        }}
                      />
                      <div className='w-[110px] h-[110px] rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer overflow-hidden transition-colors flex items-center justify-center bg-muted/20'>
                        {createImagePreview ? (
                          <img src={createImagePreview} alt='Vista previa' className='w-full h-full object-cover' />
                        ) : (
                          <div className='flex flex-col items-center gap-1 text-muted-foreground'>
                            <PlusIcon className='size-6' />
                            <span className='text-[10px]'>Elegir imagen</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value='select' className='flex-1 overflow-hidden mt-0 pt-4 flex flex-col'>
                <div className='flex gap-2 mb-3'>
                  <div className='relative flex-1'>
                    <SearchIcon className='absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
                    <Input
                      placeholder='Buscar entrenamiento'
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className='pl-8'
                    />
                  </div>
                  <Button variant='outline' size='icon' className='flex-shrink-0 h-9 w-9'>
                    <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' viewBox='0 0 256 256'><path d='M230.6,49.53A15.81,15.81,0,0,0,216,40H40A16,16,0,0,0,28.19,66.76l.08.09L96,139.17V216a16,16,0,0,0,24.87,13.32l32-21.34A16,16,0,0,0,160,194.66V139.17l67.74-72.32.08-.09A15.8,15.8,0,0,0,230.6,49.53ZM40,56h0Zm106.18,74.58A8,8,0,0,0,144,136v58.66L112,216V136a8,8,0,0,0-2.16-5.47L40,56H216Z' /></svg>
                  </Button>
                </div>

                <div className='flex-1 overflow-y-auto -mx-1 px-1'>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                    {workoutTemplates
                      .filter(w => !templateSearch || w.title?.toLowerCase().includes(templateSearch.toLowerCase()))
                      .map(w => (
                        <button
                          key={w.id}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                            assignDayTemplateId === String(w.id)
                              ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                              : 'border-border hover:bg-muted hover:shadow-sm'
                          }`}
                          onClick={() => setAssignDayTemplateId(String(w.id))}
                        >
                          {(w as any).thumbnail ? (
                            <img
                              src={(w as any).thumbnail}
                              alt=''
                              className='w-12 h-12 rounded-lg object-cover flex-shrink-0'
                            />
                          ) : (
                            <div className='w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0'>
                              <DumbbellIcon className='size-5 text-muted-foreground/50' />
                            </div>
                          )}
                          <div className='min-w-0'>
                            <p className='text-sm font-medium truncate'>{w.title}</p>
                            <p className='text-xs text-muted-foreground'>{(w as any).exercise_count ?? 0} ejercicios</p>
                          </div>
                        </button>
                      ))}
                  </div>
                  {workoutTemplates.length === 0 && (
                    <p className='text-sm text-muted-foreground text-center py-10'>No se encontraron plantillas.</p>
                  )}
                  {workoutTemplates.length > 0 && workoutTemplates.filter(w => !templateSearch || w.title?.toLowerCase().includes(templateSearch.toLowerCase())).length === 0 && (
                    <p className='text-sm text-muted-foreground text-center py-10'>No hay entrenamientos coincidentes</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value='ai' className='flex-1 overflow-y-auto mt-0 pt-4 space-y-4'>
                <div className='flex items-center justify-between'>
                  <p className='text-sm text-muted-foreground'>
                    Describe el entrenamiento que necesitas y tu entrenador IA lo crear&aacute; por ti
                  </p>
                  <Button variant='outline' size='sm' className='text-xs' onClick={() => {
                    setAiName('Full Body Strength')
                    setAiPrompt('Create a 45-minute full body strength workout with compound movements: Squats 4x8, Bench Press 4x8, Barbell Rows 4x10, Overhead Press 3x10, Romanian Deadlift 3x12')
                  }}>Probar ejemplo</Button>
                </div>

                <div className='space-y-3'>
                  <div className='space-y-1.5'>
                    <label className='text-sm font-medium'>Nombre del entrenamiento</label>
                    <Input
                      placeholder='p. ej., Fuerza de tren superior, Cardio intenso, Cuerpo completo principiante'
                      value={aiName}
                      onChange={(e) => setAiName(e.target.value)}
                    />
                  </div>
                  <div className='space-y-1.5'>
                    <label className='text-sm font-medium'>Descripción del entrenamiento</label>
                    <textarea
                      className='flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y'
                      placeholder={'Cuéntame qué quieres hacer con tu entrenamiento...\n\nEjemplos:\n• "Crea un entrenamiento de tren superior de 45 minutos"\n• "Formato: Press banca 5x8, Remo 4x10"\n• "Diseña una rutina de cuerpo completo para principiantes"'}
                      rows={6}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  className='w-full gap-2'
                  size='lg'
                  onClick={handleAiGenerate}
                  disabled={aiCreating || !aiName.trim()}
                >
                  <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='currentColor' viewBox='0 0 256 256'><path d='M213.85,125.46l-112,120a8,8,0,0,1-13.69-7l14.66-73.33L45.19,143.49a8,8,0,0,1-3-13l112-120a8,8,0,0,1,13.69,7L153.18,90.9l57.63,21.61a8,8,0,0,1,3,12.95Z' /></svg>
                  {aiCreating ? 'Generando...' : 'Crear Workout'}
                </Button>
              </TabsContent>
            </Tabs>

            <div className='flex items-center justify-end gap-2 px-4 py-3 sm:px-6 border-t bg-muted/20'>
              <Button variant='outline' onClick={() => navigate(`/training-programs/${programId}`)}>Cerrar</Button>
              {assignDayMode === 'select' && (
                <Button onClick={handleAssignDay} disabled={!assignDayTemplateId}>
                  Asignar entrenamiento
                </Button>
              )}
              {assignDayMode === 'create' && (
                <Button onClick={handleCreateAndAssign} disabled={createSubmitting || !createTitle.trim()}>
                  {createSubmitting ? 'Creando...' : 'Crear y asignar'}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </Card>

      {clipboardAssignment && (
        <div className='fixed bottom-0 left-0 right-0 z-50 bg-popover border-t shadow-lg'>
          <div className='flex flex-col gap-2 sm:flex-row items-start sm:items-center justify-between px-4 py-3 max-w-screen-2xl mx-auto'>
            <div className='flex items-center gap-2 text-sm min-w-0'>
              <CopyIcon className='size-4 shrink-0' />
              <span className='font-medium truncate'>Entrenamiento copiado: {clipboardAssignment.workout_title}</span>
              <span className='text-muted-foreground hidden sm:inline'>— haz clic en una celda del día para pegar</span>
            </div>
            <Button variant='outline' size='sm' className='w-full sm:w-auto' onClick={() => setClipboardAssignment(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <WorkoutPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        workoutTemplateId={previewTemplateId || 0}
        onEdit={() => { toast.info('Ve a Plantillas de entrenamiento para editar') }}
      />
      </>
    )
  }

  return (
    <Fragment>
      <Card>
        <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <CardTitle>Programas de entrenamiento</CardTitle>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <Input
              placeholder='Buscar programas...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='w-full sm:w-64'
            />
            <Button variant='outline' onClick={openImportDialog}>
              <UploadIcon className='size-4 mr-2' /> Importar Excel
            </Button>
            <Button onClick={openCreateDialog}>
              <PlusIcon className='size-4 mr-2' /> Nuevo programa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Entrenamiento</TableHead>
                  <TableHead># Clientes</TableHead>
                  <TableHead># Semanas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className='w-[180px]'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className='h-24 text-center'>
                      <div className='flex justify-center'>
                        <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className='font-medium'>
                        {item.title || `Programa #${item.id}`}
                      </TableCell>
                      <TableCell>{getWorkoutTitle(item)}</TableCell>
                      <TableCell>{getClientAssignmentCount(item)}</TableCell>
                      <TableCell>
                        <Badge variant='outline'>{item.num_weeks}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(item.status)}>
                          {item.status || 'Activo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex gap-1'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => openDetail(item)}
                            title='Ver detalle'
                          >
                            <EyeIcon className='size-3' />
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => openEditDialog(item)}
                            title='Editar'
                          >
                            <PencilIcon className='size-3' />
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => openAssignDialog(item)}
                            title='Asignar clientes'
                          >
                            <UsersIcon className='size-3' />
                          </Button>
                          <Button
                            variant='destructive'
                            size='sm'
                            onClick={() => openDeleteDialog(item)}
                            title='Eliminar'
                          >
                            <TrashIcon className='size-3' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className='h-24 text-center'>
                      No se encontraron programas de entrenamiento.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createEditOpen} onOpenChange={setCreateEditOpen}>
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editingProgram ? 'Editar programa de entrenamiento' : 'Nuevo programa de entrenamiento'}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título</FieldLabel>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder='Nombre del programa'
              />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Entrenamiento</FieldLabel>
              <Select value={formWorkoutId} onValueChange={(v) => setFormWorkoutId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder='Seleccionar entrenamiento' />
                </SelectTrigger>
                <SelectContent>
                  {workouts.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Número de semanas</FieldLabel>
                <Input
                  type='number'
                  min='1'
                  value={formNumWeeks}
                  onChange={(e) => setFormNumWeeks(e.target.value)}
                />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Fecha de inicio</FieldLabel>
                <Input
                  type='date'
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                />
              </Field>
            </div>

            {!editingProgram && (
              <div className='flex items-center gap-2 mt-2'>
                <Checkbox
                  checked={formAutoGenerate}
                  onCheckedChange={(checked) => setFormAutoGenerate(Boolean(checked))}
                />
                <FieldLabel className='text-sm'>Auto-generar semanas al crear</FieldLabel>
              </div>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCreateEdit} disabled={submitting}>
              {submitting ? 'Guardando...' : editingProgram ? 'Guardar cambios' : 'Crear programa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar programa de entrenamiento</DialogTitle>
          </DialogHeader>
          <p>
            ¿Seguro que quieres eliminar{' '}
            <strong>{deletingItem?.title || `Programa #${deletingItem?.id}`}</strong>? Esta acción
            no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant='destructive' onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              Asignar clientes — {assigningProgram?.title || `Programa #${assigningProgram?.id}`}
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end'>
              <Field className='gap-2'>
                <FieldLabel>Cliente</FieldLabel>
                <Select value={assignClientId} onValueChange={(v) => setAssignClientId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder='Seleccionar cliente' />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length > 0 ? (
                      availableUsers.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {getUserName(u)} ({u.email})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value='__none' disabled>
                        Todos los clientes asignados
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Fecha de inicio</FieldLabel>
                <Input
                  type='date'
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                />
              </Field>
              <Button onClick={handleAssignClient} disabled={!assignClientId}>
                Asignar
              </Button>
            </div>

            <div>
              <h4 className='text-sm font-medium text-muted-foreground mb-2'>
                Clientes asignados
              </h4>
              <div className='rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Fecha de inicio</TableHead>
                      <TableHead className='w-[80px]' />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAssignments ? (
                      <TableRow>
                        <TableCell colSpan={4} className='h-16 text-center'>
                          <div className='flex justify-center'>
                            <div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : assignments.length ? (
                      assignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className='font-medium'>
                            {getUserName(assignment.client)}
                          </TableCell>
                          <TableCell>{assignment.client?.email || '—'}</TableCell>
                          <TableCell>{assignment.start_date || '—'}</TableCell>
                          <TableCell>
                            <Button
                              variant='destructive'
                              size='sm'
                              onClick={() => handleRemoveAssignment(assignment.id)}
                            >
                              Eliminar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className='h-16 text-center'>
                          Aún no hay clientes asignados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setAssignDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Importar programa desde Excel</DialogTitle>
          </DialogHeader>

          <div className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              Sube el <code>.xlsx</code> con el formato de dos hojas (<code>Programa</code> +{' '}
              <code>Programación</code>). Primero se analiza sin escribir nada en la base de datos
              (vista previa); solo se importa de verdad cuando lo confirmes. El programa se crea en
              la biblioteca sin asignar a ningún cliente — eso se hace después desde
              &quot;Asignar clientes&quot;.
            </p>

            {!importFile ? (
              <label className='block'>
                <input
                  type='file'
                  accept='.xlsx'
                  className='hidden'
                  onChange={(e) => handleImportFileChange(e.target.files?.[0] || null)}
                />
                <div className='rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 py-10 bg-muted/20'>
                  <FileSpreadsheetIcon className='size-8 text-muted-foreground/50' />
                  <span className='text-sm font-medium'>Elegir archivo .xlsx</span>
                </div>
              </label>
            ) : (
              <div className='flex items-center justify-between rounded-lg border px-3 py-2'>
                <div className='flex items-center gap-2 min-w-0'>
                  <FileSpreadsheetIcon className='size-4 text-muted-foreground shrink-0' />
                  <span className='text-sm font-medium truncate'>{importFile.name}</span>
                </div>
                {!importDone && (
                  <Button variant='ghost' size='sm' onClick={() => handleImportFileChange(null)}>
                    <XIcon className='size-3.5' />
                  </Button>
                )}
              </div>
            )}

            {importError && (
              <div className='rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive flex items-start gap-2'>
                <AlertTriangleIcon className='size-4 shrink-0 mt-0.5' />
                <div className='space-y-2'>
                  <p>{importError}</p>
                  {importIsDuplicate && (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleConfirmImport(true)}
                      disabled={importImporting}
                    >
                      {importImporting ? 'Reimportando...' : 'Forzar reimportación'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {importPreview && !importDone && (
              <div className='space-y-3'>
                <div className='rounded-lg border px-3 py-2.5 text-sm space-y-1'>
                  <p>
                    <span className='text-muted-foreground'>Programas detectados: </span>
                    <span className='font-medium'>{importPreview.programs_detected ?? '—'}</span>
                  </p>
                  {Array.isArray(importPreview.results) && importPreview.results.map((r: any, i: number) => (
                    <p key={i} className='text-muted-foreground'>
                      {r.title || r.program?.title || `Programa ${i + 1}`}
                      {r.preview?.weeks && ` — ${r.preview.weeks.length} semana(s)`}
                    </p>
                  ))}
                </div>

                {Array.isArray(importPreview.review_required) && importPreview.review_required.length > 0 ? (
                  <div>
                    <h4 className='text-sm font-medium mb-2 flex items-center gap-1.5'>
                      <AlertTriangleIcon className='size-3.5 text-amber-500' />
                      {importPreview.review_required.length} ejercicio(s) para revisar
                    </h4>
                    <div className='rounded-md border max-h-[240px] overflow-y-auto'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ejercicio origen</TableHead>
                            <TableHead className='w-[70px]'>Nivel</TableHead>
                            <TableHead>Match sugerido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.review_required.map((r: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className='text-xs'>{r.source_exercise}</TableCell>
                              <TableCell>
                                <Badge variant={r.level === 'created' ? 'secondary' : 'outline'} className='text-[10px]'>
                                  {r.level === 'created' ? 'Nuevo' : r.level}
                                </Badge>
                              </TableCell>
                              <TableCell className='text-xs text-muted-foreground'>
                                {r.matched_title ? `${r.matched_title} (${Math.round((r.confidence || 0) * 100)}%)` : 'Se creará nuevo'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className='text-xs text-muted-foreground mt-1.5'>
                      No bloquean el import — puedes revisarlos aquí o en el panel después de importar.
                    </p>
                  </div>
                ) : (
                  <p className='text-sm text-green-600 flex items-center gap-1.5'>
                    <CheckCircle2Icon className='size-4' /> Todos los ejercicios coinciden con el catálogo (nivel A/B).
                  </p>
                )}
              </div>
            )}

            {importDone && (
              <div className='rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-3 text-sm space-y-1'>
                <p className='font-medium text-green-700 dark:text-green-400 flex items-center gap-1.5'>
                  <CheckCircle2Icon className='size-4' /> Programa importado a la biblioteca
                </p>
                {Array.isArray(importDone.results) && importDone.results.map((r: any, i: number) => (
                  <p key={i} className='text-muted-foreground text-xs'>
                    ID: {r.training_program_id ?? '—'} — {r.title || r.program?.title || ''}
                  </p>
                ))}
                <p className='text-xs text-muted-foreground pt-1'>
                  Todavía no está asignado a ningún cliente. Ciérralo y usa &quot;Asignar clientes&quot; desde la lista.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setImportDialogOpen(false)}>
              {importDone ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!importDone && !importPreview && (
              <Button onClick={handleAnalyzeImport} disabled={!importFile || importAnalyzing}>
                {importAnalyzing ? 'Analizando...' : 'Analizar (vista previa)'}
              </Button>
            )}
            {!importDone && importPreview && (
              <Button onClick={() => handleConfirmImport(false)} disabled={importImporting}>
                {importImporting ? 'Importando...' : 'Confirmar e importar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Fragment>
  )
}
