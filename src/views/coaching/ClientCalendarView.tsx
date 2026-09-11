import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Copy, X, ArrowUpDown, TrashIcon, DownloadIcon, CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { SessionDetailModal } from '@/views/coaching/SessionDetailView'

type CalendarAssignment = {
  id: number
  program_day_assignment_id: number
  workout_template_id: number | null
  workout_template?: { id: number; title: string }
  client_id: number | null
  date: string
  year: number
  month: number
  day: number
  is_direct?: boolean
  training_program_id?: number | null
  training_program?: { id: number; title: string }
  thumbnail?: string | null
  exercise_count?: number
}

type User = { id: number; name?: string; first_name?: string; last_name?: string; email: string }
type WorkoutTemplate = { id: number; title: string }
type TrainingProgram = { id: number; title: string | null }

type ClipboardData = {
  assignment: CalendarAssignment
}

type WeekActions = {
  weekNumber: number
  startDate: string
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

function getCalendarCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const startDay = (first.getDay() + 6) % 7
  const totalDays = last.getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function getTodayString() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function isDirectAssignment(a: CalendarAssignment): boolean {
  return a.is_direct === true || !a.training_program_id
}

function getWeekNumberFromGridIndex(i: number): number {
  return Math.floor(i / 7) + 1
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ClientCalendarView() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [clientId, setClientId] = useState('')
  const [clients, setClients] = useState<User[]>([])
  const [assignments, setAssignments] = useState<CalendarAssignment[]>([])
  const [, setLoading] = useState(false)
  const [workoutTemplates, setWorkoutTemplates] = useState<WorkoutTemplate[]>([])
  const [trainingPrograms, setTrainingPrograms] = useState<TrainingProgram[]>([])

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignDate, setAssignDate] = useState('')
  const [assignTemplateId, setAssignTemplateId] = useState('')

  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importProgramId, setImportProgramId] = useState('')
  const [importStartDate, setImportStartDate] = useState('')

  const [clipboard, setClipboard] = useState<ClipboardData | null>(null)
  const [draggedAssignment, setDraggedAssignment] = useState<CalendarAssignment | null>(null)

  const [weekActionsTarget, setWeekActionsTarget] = useState<WeekActions | null>(null)

  const [sessionDetailOpen, setSessionDetailOpen] = useState(false)
  const [sessionDetailAssignmentId, setSessionDetailAssignmentId] = useState<number>(0)
  const [sessionDetailClientId, setSessionDetailClientId] = useState<number>(0)

  const today = useMemo(() => getTodayString(), [])

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/admin/users?per_page=100')
      setClients(res.data?.data || res.data || [])
    } catch {
      // best-effort fetch, ignore failures
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/admin/workout-template-list?per_page=100')
      setWorkoutTemplates(res.data?.data || res.data || [])
    } catch {
      // best-effort fetch, ignore failures
    }
  }, [])

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await api.get('/admin/training-program-list?per_page=100')
      setTrainingPrograms(res.data?.data || res.data || [])
    } catch {
      // best-effort fetch, ignore failures
    }
  }, [])

  const fetchCalendar = useCallback(async () => {
    if (!clientId) {
      setAssignments([])
      return
    }
    setLoading(true)
    try {
      const res = await api.get(`/admin/client-calendar-data?client_id=${clientId}&year=${year}&month=${month}`)
      const payload = res.data?.data || res.data
      const rawDays: any[] = payload?.days || []
      const flat: CalendarAssignment[] = []
      for (const day of rawDays) {
        if (!day.workouts?.length) continue
        for (const w of day.workouts) {
          const d = new Date(day.date)
          flat.push({
            id: w.assignment_id,
            program_day_assignment_id: w.assignment_id,
            workout_template_id: w.id || null,
            workout_template: w.id ? { id: w.id, title: w.title } : undefined,
            client_id: Number(clientId),
            date: day.date,
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            day: d.getDate(),
            is_direct: w.is_personal || false,
            training_program_id: w.training_program_id || null,
            training_program: w.program_title ? { id: w.training_program_id || 0, title: w.program_title } : undefined,
            thumbnail: w.thumbnail || null,
            exercise_count: w.exercise_count || 0,
          })
        }
      }
      setAssignments(flat)
    } catch {
      toast.error('Error al cargar el calendario')
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [clientId, year, month])

  useEffect(() => {
    Promise.all([fetchClients(), fetchTemplates(), fetchPrograms()])
  }, [fetchClients, fetchTemplates, fetchPrograms])

  useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar])

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

  const cells = useMemo(() => getCalendarCells(year, month), [year, month])

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, CalendarAssignment[]>()
    for (const a of assignments) {
      const list = map.get(a.date) || []
      list.push(a)
      map.set(a.date, list)
    }
    return map
  }, [assignments])

  const handleAssignDirect = useCallback(async () => {
    if (!clientId || !assignDate || !assignTemplateId) return
    try {
      await api.post('/admin/client-calendar-assign-direct', {
        client_id: Number(clientId),
        date: assignDate,
        workout_template_id: Number(assignTemplateId)
      })
      toast.success('Entrenamiento asignado')
      setAssignDialogOpen(false)
      setAssignTemplateId('')
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al asignar')
    }
  }, [clientId, assignDate, assignTemplateId, fetchCalendar])

  const handleImportProgram = useCallback(async () => {
    if (!clientId || !importProgramId || !importStartDate) return
    try {
      await api.post('/admin/client-calendar-import-program', {
        client_id: Number(clientId),
        training_program_id: Number(importProgramId),
        start_date: importStartDate
      })
      toast.success('Programa importado correctamente')
      setImportDialogOpen(false)
      setImportProgramId('')
      setImportStartDate('')
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al importar el programa')
    }
  }, [clientId, importProgramId, importStartDate, fetchCalendar])

  const handleRemoveAssignment = useCallback(async (assignmentId: number) => {
    try {
      await api.post('/admin/client-calendar-remove', { assignment_id: assignmentId })
      toast.success('Asignación eliminada')
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al eliminar la asignación')
    }
  }, [fetchCalendar])

  const handleCopyToClipboard = useCallback((e: React.MouseEvent, assignment: CalendarAssignment) => {
    e.stopPropagation()
    if (!isDirectAssignment(assignment)) {
      toast.warning('No se pueden copiar asignaciones de programas. Solo se pueden copiar asignaciones directas.')
      return
    }
    setClipboard({ assignment })
    toast.info('Entrenamiento copiado — haz clic en un día para pegar')
  }, [])

  const handlePasteToDay = useCallback(async (dateStr: string, keepClipboard: boolean) => {
    if (!clipboard || !clientId || !dateStr) return
    try {
      await api.post('/admin/session-detail-duplicate', {
        assignment_id: clipboard.assignment.id,
        new_date: dateStr,
        client_id: Number(clientId)
      })
      toast.success(`Entrenamiento pegado en ${dateStr}`)
      if (!keepClipboard) {
        setClipboard(null)
      }
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al pegar el entrenamiento')
    }
  }, [clipboard, clientId, fetchCalendar])

  const handleDragStart = useCallback((e: React.DragEvent, assignment: CalendarAssignment) => {
    if (!isDirectAssignment(assignment)) {
      e.preventDefault()
      toast.warning('No se pueden mover asignaciones de programas.')
      return
    }
    setDraggedAssignment(assignment)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(assignment.id))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, dateStr: string) => {
    e.preventDefault()
    if (!draggedAssignment || !clientId) return
    if (draggedAssignment.date === dateStr) {
      setDraggedAssignment(null)
      return
    }
    try {
      await api.post('/admin/session-detail-duplicate', {
        assignment_id: draggedAssignment.id,
        new_date: dateStr,
        client_id: Number(clientId)
      })
      await api.post('/admin/client-calendar-remove', {
        assignment_id: draggedAssignment.id
      })
      toast.success(`Entrenamiento movido a ${dateStr}`)
      setDraggedAssignment(null)
      fetchCalendar()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al mover el entrenamiento')
      setDraggedAssignment(null)
    }
  }, [draggedAssignment, clientId, fetchCalendar])

  const handleDayClick = useCallback((dateStr: string, ctrlKey: boolean) => {
    if (!clientId) return
    if (clipboard) {
      handlePasteToDay(dateStr, ctrlKey)
      return
    }
    setAssignDate(dateStr)
    setAssignTemplateId('')
    fetchTemplates()
    setAssignDialogOpen(true)
  }, [clientId, clipboard, handlePasteToDay, fetchTemplates])

  const handleBadgeTitleClick = useCallback((e: React.MouseEvent, assignment: CalendarAssignment) => {
    e.stopPropagation()
    if (!clientId) {
      toast.info('Selecciona un cliente para ver el detalle de la sesión')
      return
    }
    if (!assignment.program_day_assignment_id) {
      toast.info('Aún no hay detalle de sesión para asignaciones directas')
      return
    }
    setSessionDetailAssignmentId(assignment.program_day_assignment_id)
    setSessionDetailClientId(Number(clientId))
    setSessionDetailOpen(true)
  }, [clientId])

  const getDirectAssignmentsForWeek = useCallback((weekNum: number): CalendarAssignment[] => {
    const startIdx = (weekNum - 1) * 7
    const endIdx = Math.min(startIdx + 7, cells.length)
    const weekDates = cells.slice(startIdx, endIdx).filter(Boolean) as string[]
    if (weekDates.length === 0) return []
    const startStr = weekDates[0]
    const endStr = weekDates[weekDates.length - 1]
    return assignments.filter(a => isDirectAssignment(a) && a.date >= startStr && a.date <= endStr)
  }, [assignments, cells])

  const handleMoveWeekUp = useCallback(async (weekNum: number) => {
    if (weekNum <= 1) {
      toast.info('Ya es la primera semana')
      return
    }
    const currentWeek = getDirectAssignmentsForWeek(weekNum)
    const prevWeek = getDirectAssignmentsForWeek(weekNum - 1)

    if (currentWeek.length === 0 && prevWeek.length === 0) return
    if (currentWeek.length === 0) {
      toast.info('No hay asignaciones esta semana para intercambiar')
      return
    }

    try {
      for (const a of currentWeek) {
        const prevDate = new Date(a.date)
        prevDate.setDate(prevDate.getDate() - 7)
        await api.post('/admin/session-detail-duplicate', {
          assignment_id: a.id,
          new_date: formatDateISO(prevDate),
          client_id: Number(clientId)
        })
        await api.post('/admin/client-calendar-remove', { assignment_id: a.id })
      }
      for (const a of prevWeek) {
        const nextDate = new Date(a.date)
        nextDate.setDate(nextDate.getDate() + 7)
        await api.post('/admin/session-detail-duplicate', {
          assignment_id: a.id,
          new_date: formatDateISO(nextDate),
          client_id: Number(clientId)
        })
        await api.post('/admin/client-calendar-remove', { assignment_id: a.id })
      }
      toast.success('Semanas intercambiadas')
      fetchCalendar()
    } catch {
      toast.error('Error al intercambiar las semanas')
    }
  }, [clientId, getDirectAssignmentsForWeek, fetchCalendar])

  const handleMoveWeekDown = useCallback(async (weekNum: number) => {
    const nextWeek = getDirectAssignmentsForWeek(weekNum + 1)
    const currentWeek = getDirectAssignmentsForWeek(weekNum)

    if (currentWeek.length === 0) {
      toast.info('No hay asignaciones esta semana para intercambiar')
      return
    }

    try {
      for (const a of currentWeek) {
        const nextDate = new Date(a.date)
        nextDate.setDate(nextDate.getDate() + 7)
        await api.post('/admin/session-detail-duplicate', {
          assignment_id: a.id,
          new_date: formatDateISO(nextDate),
          client_id: Number(clientId)
        })
        await api.post('/admin/client-calendar-remove', { assignment_id: a.id })
      }
      for (const a of nextWeek) {
        const prevDate = new Date(a.date)
        prevDate.setDate(prevDate.getDate() - 7)
        await api.post('/admin/session-detail-duplicate', {
          assignment_id: a.id,
          new_date: formatDateISO(prevDate),
          client_id: Number(clientId)
        })
        await api.post('/admin/client-calendar-remove', { assignment_id: a.id })
      }
      toast.success('Semanas intercambiadas')
      fetchCalendar()
    } catch {
      toast.error('Error al intercambiar las semanas')
    }
  }, [clientId, getDirectAssignmentsForWeek, fetchCalendar])

  const handleDuplicateWeek = useCallback(async (weekNum: number) => {
    const weekAssignments = getDirectAssignmentsForWeek(weekNum)
    if (weekAssignments.length === 0) {
      toast.info('No hay asignaciones directas esta semana para duplicar')
      return
    }

    try {
      for (const a of weekAssignments) {
        const newDate = new Date(a.date)
        newDate.setDate(newDate.getDate() + 7)
        await api.post('/admin/session-detail-duplicate', {
          assignment_id: a.id,
          new_date: formatDateISO(newDate),
          client_id: Number(clientId)
        })
      }
      toast.success('Semana duplicada')
      fetchCalendar()
    } catch {
      toast.error('Error al duplicar la semana')
    }
  }, [clientId, getDirectAssignmentsForWeek, fetchCalendar])

  const handleClearWeek = useCallback(async (weekNum: number) => {
    const weekAssignments = getDirectAssignmentsForWeek(weekNum)
    if (weekAssignments.length === 0) {
      toast.info('No hay asignaciones directas esta semana para vaciar')
      return
    }

    try {
      for (const a of weekAssignments) {
        await api.post('/admin/client-calendar-remove', { assignment_id: a.id })
      }
      toast.success('Semana vaciada')
      setWeekActionsTarget(null)
      fetchCalendar()
    } catch {
      toast.error('Error al vaciar la semana')
    }
  }, [getDirectAssignmentsForWeek, fetchCalendar])

  const handleBadgeTitleKeyDown = useCallback((e: React.KeyboardEvent, assignment: CalendarAssignment) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleBadgeTitleClick(e as any, assignment)
    }
  }, [handleBadgeTitleClick])

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div className='flex items-center gap-4'>
            <CardTitle>Calendario del cliente</CardTitle>
            <Select value={clientId} onValueChange={v => setClientId(v ?? '')}>
              <SelectTrigger className='w-[280px]'>
                <SelectValue placeholder='Seleccionar cliente' />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim()} ({c.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className='flex items-center gap-2 text-xs text-muted-foreground ml-2'>
              <span className='flex items-center gap-1'>
                <span className='inline-block h-3 w-3 rounded bg-blue-100 border border-blue-300' />
                Directo
              </span>
              <span className='flex items-center gap-1'>
                <span className='inline-block h-3 w-3 rounded bg-green-100 border border-green-300' />
                Programa
              </span>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                setImportStartDate('')
                setImportProgramId('')
                setImportDialogOpen(true)
              }}
            >
              <DownloadIcon className='size-4 mr-1' />
              Importar programa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!clientId ? (
            <div className='flex flex-col items-center justify-center py-20 text-muted-foreground'>
              <CalendarIcon className='size-12 mb-4 opacity-50' />
              <p>Selecciona un cliente para ver su calendario</p>
            </div>
          ) : (
            <>
              <div className='flex items-center justify-between mb-4'>
                <Button variant='outline' size='sm' onClick={prevMonth}>
                  <ChevronLeft className='size-4' />
                  <span className='ml-1'>Mes</span>
                </Button>
                <h3 className='text-lg font-semibold'>
                  {MONTH_NAMES[month - 1]} {year}
                </h3>
                <Button variant='outline' size='sm' onClick={nextMonth}>
                  <span className='mr-1'>Mes</span>
                  <ChevronRight className='size-4' />
                </Button>
              </div>

              <div className='grid grid-cols-7 border-t border-l'>
                {DAYS.map(d => (
                  <div
                    key={d}
                    className='border-r border-b bg-muted/50 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground'
                  >
                    {d}
                  </div>
                ))}
                {cells.map((dateStr, i) => {
                  const dayAssignments = dateStr ? (assignmentsByDate.get(dateStr) || []) : []
                  const isToday = dateStr === today
                  const hasClipboard = !!clipboard
                  const weekNum = dateStr ? getWeekNumberFromGridIndex(i) : 0
                  const isFirstDayOfWeek = dateStr && (i % 7 === 0)

                  return (
                    <div
                      key={i}
                      className={`
                        border-r border-b min-h-[110px] p-1.5 transition-colors
                        ${dateStr
                          ? hasClipboard
                            ? 'bg-background hover:bg-muted/40 cursor-copy'
                            : 'bg-background hover:bg-muted/30 cursor-pointer'
                          : 'bg-muted/30'
                        }
                      `}
                      onClick={(e) => {
                        if (dateStr) {
                          if (clipboard) {
                            handlePasteToDay(dateStr, e.ctrlKey || e.metaKey)
                          } else if (clientId) {
                            handleDayClick(dateStr, e.ctrlKey || e.metaKey)
                          }
                        }
                      }}
                      onDragOver={dateStr ? handleDragOver : undefined}
                      onDrop={dateStr ? (e) => handleDrop(e, dateStr) : undefined}
                    >
                      {dateStr && (
                        <>
                          <div className='flex items-center justify-between mb-1'>
                            <div className={`text-xs font-medium ${isToday ? 'text-primary font-bold bg-primary/10 rounded px-1' : ''}`}>
                              {parseInt(dateStr.split('-')[2])}
                            </div>
                            {isFirstDayOfWeek && weekNum > 0 && (
                              <div
                                className='relative'
                                onMouseEnter={() => setWeekActionsTarget({ weekNumber: weekNum, startDate: dateStr })}
                                onMouseLeave={() => setWeekActionsTarget(null)}
                              >
                                <span className='text-[9px] font-bold text-muted-foreground bg-muted/70 rounded px-1 cursor-default select-none'>
                                  W{weekNum}
                                </span>
                                {weekActionsTarget?.weekNumber === weekNum && (
                                  <div
                                    className='absolute right-0 top-full z-50 mt-1 bg-popover border rounded-md shadow-lg p-1 flex flex-col gap-0.5 min-w-[120px]'
                                    onMouseEnter={() => setWeekActionsTarget({ weekNumber: weekNum, startDate: dateStr })}
                                    onMouseLeave={() => setWeekActionsTarget(null)}
                                  >
                                    <button
                                      className='flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-muted text-left w-full'
                                      onClick={(e) => { e.stopPropagation(); handleMoveWeekUp(weekNum) }}
                                    >
                                      <ArrowUpDown className='size-3' /> Mover arriba
                                    </button>
                                    <button
                                      className='flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-muted text-left w-full'
                                      onClick={(e) => { e.stopPropagation(); handleMoveWeekDown(weekNum) }}
                                    >
                                      <ArrowUpDown className='size-3 rotate-180' /> Mover abajo
                                    </button>
                                    <button
                                      className='flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-muted text-left w-full'
                                      onClick={(e) => { e.stopPropagation(); handleDuplicateWeek(weekNum) }}
                                    >
                                      <Copy className='size-3' /> Duplicar semana
                                    </button>
                                    <div className='border-t my-0.5' />
                                    <button
                                      className='flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-destructive/10 text-destructive text-left w-full'
                                      onClick={(e) => { e.stopPropagation(); handleClearWeek(weekNum) }}
                                    >
                                      <TrashIcon className='size-3' /> Vaciar semana
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className='space-y-0.5'>
                            {dayAssignments.map((assignment) => {
                              const direct = isDirectAssignment(assignment)
                              const title = assignment.workout_template?.title || `Entrenamiento #${assignment.workout_template_id}`
                              const programTitle = assignment.training_program?.title

                              return (
                                <div
                                  key={assignment.id}
                                  draggable={direct}
                                  onDragStart={direct ? (e) => handleDragStart(e, assignment) : undefined}
                                  className={`
                                    text-[10px] leading-tight px-1 py-0.5 rounded group relative
                                    ${direct
                                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                      : 'bg-green-100 text-green-800 border border-green-200'
                                    }
                                  `}
                                >
                                  <div className='flex items-center justify-between gap-0.5'>
                                    <span
                                      className='truncate flex-1 cursor-pointer hover:underline font-medium'
                                      onClick={(e) => handleBadgeTitleClick(e, assignment)}
                                      onKeyDown={(e) => handleBadgeTitleKeyDown(e, assignment)}
                                      tabIndex={0}
                                      role='button'
                                      title={`Ver sesión: ${title}`}
                                    >
                                      {title}
                                    </span>
                                    <div className='flex items-center gap-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity'>
                                      <button
                                        className='hover:text-blue-600 p-0'
                                        title='Copiar al portapapeles'
                                        onClick={(e) => handleCopyToClipboard(e, assignment)}
                                      >
                                        <Copy className='size-[10px]' />
                                      </button>
                                      <button
                                        className='hover:text-red-600 p-0'
                                        title='Eliminar'
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (window.confirm('¿Eliminar esta asignación?')) {
                                            handleRemoveAssignment(assignment.id)
                                          }
                                        }}
                                      >
                                        <X className='size-[10px]' />
                                      </button>
                                    </div>
                                  </div>
                                  {programTitle && (
                                    <div className='text-[8px] opacity-70 truncate'>{programTitle}</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {clipboard && (
        <div className='fixed bottom-0 left-0 right-0 z-50 bg-popover border-t shadow-lg'>
          <div className='flex items-center justify-between px-4 py-3 max-w-screen-2xl mx-auto'>
            <div className='flex items-center gap-2 text-sm'>
              <span className='text-base'>📋</span>
              <span className='font-medium'>Entrenamiento copiado</span>
              <span className='text-muted-foreground'>— haz clic en un día para pegar (Ctrl+clic para pegar en varios días)</span>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setClipboard(null)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar entrenamiento para el {assignDate}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Plantilla de entrenamiento</FieldLabel>
              <Select value={assignTemplateId} onValueChange={v => setAssignTemplateId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder='Seleccionar plantilla' />
                </SelectTrigger>
                <SelectContent>
                  {workoutTemplates.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAssignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignDirect} disabled={!assignTemplateId}>
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar programa de entrenamiento</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Programa</FieldLabel>
              <Select value={importProgramId} onValueChange={v => setImportProgramId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder='Seleccionar programa' />
                </SelectTrigger>
                <SelectContent>
                  {trainingPrograms.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.title || `Programa #${p.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Fecha de inicio</FieldLabel>
              <input
                type='date'
                className='border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2'
                value={importStartDate}
                onChange={e => setImportStartDate(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setImportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImportProgram} disabled={!importProgramId || !importStartDate}>
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SessionDetailModal
        open={sessionDetailOpen}
        onOpenChange={setSessionDetailOpen}
        programDayAssignmentId={sessionDetailAssignmentId}
        clientId={sessionDetailClientId}
      />
    </>
  )
}
