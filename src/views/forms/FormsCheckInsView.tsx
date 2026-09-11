import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { format } from 'date-fns'
import { es } from 'date-fns/locale/es'
import {
  PlusIcon, PencilIcon, TrashIcon, SendIcon, EyeIcon, FileTextIcon,
  TypeIcon, HashIcon, ListIcon, BarChartIcon, ToggleLeftIcon, CalendarIcon, ImageIcon,
  StarIcon, PenLineIcon, CameraIcon, ActivityIcon, XIcon, GripVerticalIcon, ArrowLeftIcon,
  ClipboardCheckIcon, CalendarDays
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type FormItem = {
  id: number
  title: string
  description: string | null
  recurrence: string | null
  questions_count: number
}

type FormQuestion = {
  id: number
  form_id: number
  question_text: string
  type: string
  order: number
  is_required: boolean
  options: string[] | null
  max_files: number | null
  metric_id: number | null
  metric?: { id: number; key: string; label: string; unit: string | null } | null
  sync_type: string | null
  allow_multiple: boolean
  placeholder: string | null
  scale_max: number
  star_max: number
}

type Client = { id: number; first_name: string; last_name: string; email: string }

type FormSubmission = {
  id: number
  submitted_at: string
  coach_feedback: string | null
  form_assignment: { form: FormItem; client: Client }
  answers: { id: number; question: FormQuestion; answer_value: string | null }[]
}

type Metric = { id: number; key: string; label: string; unit: string | null }

const QUESTION_TYPES = [
  { value: 'text', label: 'Texto', icon: TypeIcon, color: '#328048', desc: 'Texto corto o largo' },
  { value: 'textarea', label: 'Área de texto', icon: TypeIcon, color: '#328048', desc: 'Respuesta de texto largo' },
  { value: 'number', label: 'Número', icon: HashIcon, color: '#D02B20', desc: 'Números' },
  { value: 'scale', label: 'Escala', icon: BarChartIcon, color: '#0C75AF', desc: 'Escala del 1 al N' },
  { value: 'yes_no', label: 'Sí / No', icon: ToggleLeftIcon, color: '#9736E8', desc: 'Sí o no' },
  { value: 'date', label: 'Fecha', icon: CalendarIcon, color: '#666687', desc: 'Selecciona una fecha' },
  { value: 'multiple_choice', label: 'Opción múltiple', icon: ListIcon, color: '#D9822F', desc: 'Elige opciones' },
  { value: 'media', label: 'Multimedia', icon: ImageIcon, color: '#328048', desc: 'Imagen o vídeo' },
  { value: 'progress_photos', label: 'Fotos de progreso', icon: CameraIcon, color: '#0C75AF', desc: 'Sincronizar con la galería' },
  { value: 'star_rating', label: 'Puntuación con estrellas', icon: StarIcon, color: '#D9822F', desc: 'Puntuación con estrellas 1-5' },
  { value: 'metric', label: 'Métrica', icon: ActivityIcon, color: '#9736E8', desc: 'Sincronizar con métricas' },
  { value: 'signature', label: 'Firma', icon: PenLineIcon, color: '#0C75AF', desc: 'Firma digital' },
]

const RECURRENCE_OPTIONS = [
  { label: 'Cuestionario (una sola vez)', value: '' },
  { label: 'Diario', value: 'daily' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Mensual', value: 'monthly' },
]

const TYPE_LABELS: Record<string, string> = {
  text: 'Texto', textarea: 'Área de texto', number: 'Número', scale: 'Escala', yes_no: 'Sí/No', date: 'Fecha',
  multiple_choice: 'Opción múltiple', media: 'Multimedia', progress_photos: 'Fotos de progreso',
  star_rating: 'Puntuación con estrellas', metric: 'Métrica', signature: 'Firma',
}

const TypeIconComponent = ({ type, className }: { type: string; className?: string }) => {
  const config = QUESTION_TYPES.find(t => t.value === type) || QUESTION_TYPES[0]
  const Icon = config.icon
  return <Icon className={className} style={{ color: config.color }} />
}

export default function FormsCheckInsView() {
  const navigate = useNavigate()
  const params = useParams()
  const formIdParam = params.tab && /^\d+$/.test(params.tab) ? Number(params.tab) : null
  const detailView = formIdParam !== null
  const activeTab = params.tab === 'envios' ? 'submissions' : 'forms'
  const goToTab = (value: string) => navigate(`/forms-checkins/${value === 'submissions' ? 'envios' : 'formularios'}`)
  const [forms, setForms] = useState<FormItem[]>([])
  const [formsLoading, setFormsLoading] = useState(true)
  const [selectedForm, setSelectedForm] = useState<FormItem | null>(null)
  const [questions, setQuestions] = useState<FormQuestion[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)

  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editingForm, setEditingForm] = useState<FormItem | null>(null)
  const [formForm, setFormForm] = useState({ title: '', description: '', recurrence: '' })

  const [questionDialogOpen, setQuestionDialogOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null)
  const [questionForm, setQuestionForm] = useState<Partial<FormQuestion>>({
    question_text: '', type: 'text', order: 0, is_required: false,
    options: [], max_files: 1, metric_id: null, sync_type: null,
    allow_multiple: false, placeholder: '', scale_max: 10, star_max: 5,
  })
  const [newOption, setNewOption] = useState('')

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assignFormId, setAssignFormId] = useState('')
  const [assignClientId, setAssignClientId] = useState('')
  // 'recurrence' = comportamiento previo (según Form.recurrence, una sola
  // asignación). 'dates' = nuevo — una asignación de una sola vez por cada
  // fecha concreta elegida, independiente de la recurrencia del formulario.
  const [assignMode, setAssignMode] = useState<'recurrence' | 'dates'>('recurrence')
  const [assignDates, setAssignDates] = useState<Date[]>([])

  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [feedbackSubmission, setFeedbackSubmission] = useState<FormSubmission | null>(null)
  const [feedbackText, setFeedbackText] = useState('')

  const fetchForms = useCallback(async () => {
    setFormsLoading(true)
    try {
      const res = await api.get('/admin/admin-form-list?per_page=100')
      setForms(res.data?.data || [])
    } catch {
      toast.error('Error al obtener los formularios')
    } finally {
      setFormsLoading(false)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/admin/users?per_page=500')
      setClients(res.data || [])
    } catch {
      // best-effort fetch, ignore failures
    }
  }, [])

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await api.get('/admin/metric-list')
      setMetrics(res.data || [])
    } catch {
      // best-effort fetch, ignore failures
    }
  }, [])

  const fetchSubmissions = useCallback(async () => {
    setSubmissionsLoading(true)
    try {
      const res = await api.get('/admin/admin-form-submission-list?per_page=100')
      setSubmissions(res.data?.data || [])
    } catch {
      setSubmissions([])
    } finally {
      setSubmissionsLoading(false)
    }
  }, [])

  useEffect(() => { fetchForms(); fetchClients(); fetchMetrics() }, [fetchForms, fetchClients, fetchMetrics])
  useEffect(() => { if (activeTab === 'submissions') fetchSubmissions() }, [activeTab, fetchSubmissions])

  useEffect(() => {
    if (!selectedForm) { setQuestions([]); return }
    const fetchQuestions = async () => {
      setQuestionsLoading(true)
      try {
        const res = await api.get(`/admin/admin-form-detail?id=${selectedForm.id}`)
        setQuestions(res.data?.questions || [])
      } catch {
        setQuestions([])
      } finally {
        setQuestionsLoading(false)
      }
    }
    fetchQuestions()
  }, [selectedForm])

  useEffect(() => {
    if (formIdParam === null) {
      setSelectedForm(null)
      setQuestions([])
      return
    }
    if (selectedForm?.id === formIdParam) return
    const found = forms.find(f => f.id === formIdParam)
    if (found) {
      setSelectedForm(found)
    } else if (forms.length > 0) {
      setSelectedForm({ id: formIdParam, title: `Formulario #${formIdParam}`, description: null, recurrence: null, questions_count: 0 })
    }
  }, [formIdParam, forms, selectedForm])

  const handleSaveForm = async () => {
    if (!formForm.title.trim()) return
    try {
      const payload: any = {
        title: formForm.title.trim(),
        description: formForm.description.trim() || null,
        recurrence: formForm.recurrence || null,
      }
      if (editingForm) payload.id = editingForm.id
      const res = await api.post('/admin/admin-form-store', payload)
      const saved = res.data
      if (editingForm) {
        setForms(prev => prev.map(f => f.id === saved.id ? saved : f))
      } else {
        setForms(prev => [saved, ...prev])
      }
      setFormDialogOpen(false)
      toast.success('Formulario guardado')
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar el formulario')
    }
  }

  const handleDeleteForm = async (formId: number) => {
    if (!confirm('¿Eliminar este formulario y todas sus preguntas?')) return
    try {
      await api.post('/admin/admin-form-delete', { id: formId })
      setForms(prev => prev.filter(f => f.id !== formId))
      if (selectedForm?.id === formId) { navigate('/forms-checkins/formularios') }
      toast.success('Formulario eliminado')
    } catch { toast.error('Error al eliminar el formulario') }
  }

  const handleSaveQuestion = async () => {
    if (!questionForm.question_text?.trim() || !selectedForm) return
    try {
      const payload: any = {
        form_id: selectedForm.id,
        question_text: questionForm.question_text.trim(),
        type: questionForm.type,
        order: Number(questionForm.order ?? 0),
        is_required: questionForm.is_required ?? false,
        options: questionForm.options,
        max_files: questionForm.max_files,
        metric_id: questionForm.metric_id,
        sync_type: questionForm.sync_type,
        allow_multiple: questionForm.allow_multiple ?? false,
        placeholder: questionForm.placeholder,
        scale_max: Number(questionForm.scale_max ?? 10),
        star_max: Number(questionForm.star_max ?? 5),
      }
      if (editingQuestion) payload.id = editingQuestion.id
      const res = await api.post('/admin/admin-form-question-store', payload)
      const saved = res.data
      if (editingQuestion) {
        setQuestions(prev => prev.map(q => q.id === saved.id ? saved : q))
      } else {
        setQuestions(prev => [...prev, saved].sort((a, b) => a.order - b.order))
      }
      setQuestionDialogOpen(false)
      toast.success('Pregunta guardada')
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar la pregunta')
    }
  }

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm('¿Eliminar esta pregunta?')) return
    try {
      await api.post('/admin/admin-form-question-delete', { id: questionId })
      setQuestions(prev => prev.filter(q => q.id !== questionId))
      toast.success('Pregunta eliminada')
    } catch { toast.error('Error al eliminar la pregunta') }
  }

  const handleAssign = async () => {
    if (!assignFormId || !assignClientId) return
    if (assignMode === 'dates' && assignDates.length === 0) return
    try {
      const payload: any = { form_id: Number(assignFormId), client_id: Number(assignClientId) }
      if (assignMode === 'dates') {
        payload.scheduled_dates = assignDates.map(d => format(d, 'yyyy-MM-dd'))
      }
      await api.post('/admin/admin-form-assign', payload)
      toast.success(
        assignMode === 'dates' && assignDates.length > 1
          ? `Formulario asignado a ${assignDates.length} fechas`
          : 'Formulario asignado'
      )
      setAssignDialogOpen(false)
      setAssignFormId('')
      setAssignClientId('')
      setAssignMode('recurrence')
      setAssignDates([])
    } catch (err: any) {
      toast.error(err?.message || 'Error al asignar el formulario')
    }
  }

  const handleSaveFeedback = async () => {
    if (!feedbackSubmission) return
    try {
      await api.post('/admin/admin-form-feedback', { submission_id: feedbackSubmission.id, coach_feedback: feedbackText })
      setSubmissions(prev => prev.map(s => s.id === feedbackSubmission.id ? { ...s, coach_feedback: feedbackText } : s))
      setFeedbackDialogOpen(false)
      toast.success('Comentario guardado')
    } catch { toast.error('Error al guardar el comentario') }
  }

  const openCreateForm = () => {
    setEditingForm(null)
    setFormForm({ title: '', description: '', recurrence: '' })
    setFormDialogOpen(true)
  }

  const openEditForm = (form: FormItem) => {
    setEditingForm(form)
    setFormForm({ title: form.title, description: form.description || '', recurrence: form.recurrence || '' })
    setFormDialogOpen(true)
  }

  const openCreateQuestion = () => {
    setEditingQuestion(null)
    setQuestionForm({
      question_text: '', type: 'text', order: questions.length, is_required: false,
      options: [], max_files: 1, metric_id: null, sync_type: null,
      allow_multiple: false, placeholder: '', scale_max: 10, star_max: 5,
    })
    setNewOption('')
    setQuestionDialogOpen(true)
  }

  const openEditQuestion = (q: FormQuestion) => {
    setEditingQuestion(q)
    setQuestionForm({
      question_text: q.question_text,
      type: q.type,
      order: q.order,
      is_required: q.is_required,
      options: q.options || [],
      max_files: q.max_files ?? 1,
      metric_id: q.metric_id,
      sync_type: q.sync_type,
      allow_multiple: q.allow_multiple,
      placeholder: q.placeholder || '',
      scale_max: q.scale_max,
      star_max: q.star_max,
    })
    setNewOption('')
    setQuestionDialogOpen(true)
  }

  const addOption = () => {
    if (!newOption.trim()) return
    setQuestionForm(prev => ({ ...prev, options: [...(prev.options || []), newOption.trim()] }))
    setNewOption('')
  }

  const removeOption = (idx: number) => {
    setQuestionForm(prev => ({ ...prev, options: (prev.options || []).filter((_, i) => i !== idx) }))
  }

  const renderQuestionConfig = () => {
    const type = questionForm.type || 'text'
    if (type === 'multiple_choice') {
      return (
        <div className='space-y-3 rounded-lg border p-3'>
          <div className='flex items-center gap-3'>
            <Switch checked={questionForm.allow_multiple} onCheckedChange={v => setQuestionForm(prev => ({ ...prev, allow_multiple: v }))} />
            <span className='text-sm'>Permitir varias selecciones</span>
          </div>
          <Field className='gap-2'>
            <FieldLabel>Opciones</FieldLabel>
            <div className='space-y-2'>
              {(questionForm.options || []).map((opt, idx) => (
                <div key={idx} className='flex items-center gap-2'>
                  <Input value={opt} readOnly className='bg-muted' />
                  <Button variant='ghost' size='sm' onClick={() => removeOption(idx)}><XIcon className='size-3.5 text-destructive' /></Button>
                </div>
              ))}
              <div className='flex items-center gap-2'>
                <Input placeholder='Añadir opción...' value={newOption} onChange={e => setNewOption(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }} />
                <Button variant='outline' size='sm' onClick={addOption}><PlusIcon className='size-3.5' /></Button>
              </div>
            </div>
          </Field>
        </div>
      )
    }
    if (type === 'media' || type === 'progress_photos') {
      return (
        <div className='space-y-3 rounded-lg border p-3'>
          <Field className='gap-2'>
            <FieldLabel>Máximo de archivos</FieldLabel>
            <Input type='number' min={1} max={10} value={questionForm.max_files ?? 1} onChange={e => setQuestionForm(prev => ({ ...prev, max_files: Number(e.target.value) }))} />
          </Field>
          {type === 'progress_photos' && (
            <p className='text-xs text-muted-foreground'>Las fotos se sincronizarán con la galería de progreso del cliente.</p>
          )}
        </div>
      )
    }
    if (type === 'scale') {
      return (
        <div className='space-y-3 rounded-lg border p-3'>
          <Field className='gap-2'>
            <FieldLabel>Escala máxima</FieldLabel>
            <Input type='number' min={1} max={100} value={questionForm.scale_max ?? 10} onChange={e => setQuestionForm(prev => ({ ...prev, scale_max: Number(e.target.value) }))} />
          </Field>
        </div>
      )
    }
    if (type === 'star_rating') {
      return (
        <div className='space-y-3 rounded-lg border p-3'>
          <Field className='gap-2'>
            <FieldLabel>Estrellas máximas</FieldLabel>
            <Input type='number' min={1} max={10} value={questionForm.star_max ?? 5} onChange={e => setQuestionForm(prev => ({ ...prev, star_max: Number(e.target.value) }))} />
          </Field>
        </div>
      )
    }
    if (type === 'metric') {
      return (
        <div className='space-y-3 rounded-lg border p-3'>
          <Field className='gap-2'>
            <FieldLabel>Métrica a sincronizar</FieldLabel>
            <Select value={questionForm.metric_id ? String(questionForm.metric_id) : ''} onValueChange={v => setQuestionForm(prev => ({ ...prev, metric_id: v ? Number(v) : null }))}>
              <SelectTrigger><SelectValue placeholder='Seleccionar una métrica' /></SelectTrigger>
              <SelectContent>
                {metrics.map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.label} {m.unit ? `(${m.unit})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <p className='text-xs text-muted-foreground'>La respuesta se guardará en el gráfico de métricas del cliente.</p>
        </div>
      )
    }
    return (
      <div className='space-y-3 rounded-lg border p-3'>
        <Field className='gap-2'>
          <FieldLabel>Marcador de posición</FieldLabel>
          <Input placeholder='Marcador opcional' value={questionForm.placeholder || ''} onChange={e => setQuestionForm(prev => ({ ...prev, placeholder: e.target.value }))} />
        </Field>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {!detailView ? (
        <>
          <div className='flex items-center justify-between'>
            <h1 className='text-xl font-semibold'>Formularios y Check-ins</h1>
            <Button onClick={openCreateForm}>
              <PlusIcon className='size-4 mr-1' /> Nuevo Formulario
            </Button>
          </div>

          <Card className='bg-muted/30'>
            <CardContent className='py-3 flex items-center gap-3'>
              <ClipboardCheckIcon className='size-5 text-muted-foreground shrink-0' />
              <div className='flex-1'>
                <p className='text-sm font-medium'>Chequeo diario de preparación</p>
                <p className='text-xs text-muted-foreground'>Sueño, agujetas, energía y estrés antes de cada entrenamiento — sistema fijo del código de la app, no un formulario creado aquí. Se activa/desactiva por cliente desde su perfil → Configuración, y sus respuestas se ven en el perfil de cada cliente → Entrenamiento → Feedback de sesión, o en su pestaña Check-ins.</p>
              </div>
              <Badge variant='secondary'>Sistema</Badge>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={goToTab}>
            <TabsList>
              <TabsTrigger value='forms'>Formularios</TabsTrigger>
              <TabsTrigger value='submissions'>Envíos</TabsTrigger>
            </TabsList>

            <TabsContent value='forms' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Formularios</CardTitle>
                </CardHeader>
                <CardContent className='p-0'>
                  {formsLoading ? (
                    <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                  ) : forms.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Título</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Preguntas</TableHead>
                          <TableHead className='text-right'>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {forms.map(form => (
                          <TableRow key={form.id}>
                            <TableCell>
                              <button className='text-left hover:underline' onClick={() => navigate(`/forms-checkins/${form.id}`)}>
                                <p className='font-medium text-sm'>{form.title}</p>
                                {form.description && <p className='text-xs text-muted-foreground truncate max-w-[300px]'>{form.description}</p>}
                              </button>
                            </TableCell>
                            <TableCell>
                              <Badge variant={form.recurrence ? 'default' : 'secondary'}>
                                {form.recurrence ? `Check-in (${form.recurrence})` : 'Cuestionario'}
                              </Badge>
                            </TableCell>
                            <TableCell>{form.questions_count}</TableCell>
                            <TableCell className='text-right'>
                              <div className='flex items-center justify-end gap-1'>
                                <Button variant='ghost' size='sm' onClick={() => navigate(`/forms-checkins/${form.id}`)}>
                                  <EyeIcon className='size-3.5' />
                                </Button>
                                <Button variant='ghost' size='sm' onClick={() => { setSelectedForm(form); setAssignFormId(String(form.id)); setAssignMode('recurrence'); setAssignDates([]); setAssignDialogOpen(true) }}>
                                  <SendIcon className='size-3.5' />
                                </Button>
                                <Button variant='ghost' size='sm' onClick={() => openEditForm(form)}>
                                  <PencilIcon className='size-3.5' />
                                </Button>
                                <Button variant='ghost' size='sm' onClick={() => handleDeleteForm(form.id)}>
                                  <TrashIcon className='size-3.5 text-destructive' />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className='flex flex-col items-center py-12 text-muted-foreground'>
                      <FileTextIcon className='size-12 mb-4 opacity-50' />
                      <p className='text-sm'>Aún no hay formularios</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='submissions'>
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Envíos recientes</CardTitle>
                </CardHeader>
                <CardContent className='p-0'>
                  {submissionsLoading ? (
                    <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                  ) : submissions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Formulario</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Enviado</TableHead>
                          <TableHead>Comentario</TableHead>
                          <TableHead className='text-right'>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissions.map(s => (
                          <TableRow key={s.id}>
                            <TableCell className='font-medium text-sm'>{s.form_assignment?.form?.title}</TableCell>
                            <TableCell>{s.form_assignment?.client?.first_name} {s.form_assignment?.client?.last_name}</TableCell>
                            <TableCell>{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}</TableCell>
                            <TableCell>
                              {s.coach_feedback ? <Badge variant='default'>Proporcionado</Badge> : <Badge variant='secondary'>Pendiente</Badge>}
                            </TableCell>
                            <TableCell className='text-right'>
                              <Button variant='ghost' size='sm' onClick={() => { setFeedbackSubmission(s); setFeedbackText(s.coach_feedback || ''); setFeedbackDialogOpen(true) }}>
                                <EyeIcon className='size-3.5' />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className='text-center text-muted-foreground py-12'>Aún no hay envíos.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <Button variant='ghost' size='sm' onClick={() => navigate('/forms-checkins/formularios')}>
                <ArrowLeftIcon className='size-4 mr-1' /> Volver
              </Button>
              <h1 className='text-xl font-semibold'>{selectedForm?.title}</h1>
              <Badge variant={selectedForm?.recurrence ? 'default' : 'secondary'}>
                {selectedForm?.recurrence ? `Check-in (${selectedForm.recurrence})` : 'Cuestionario'}
              </Badge>
            </div>
            <div className='flex items-center gap-2'>
              <Button variant='outline' size='sm' onClick={() => { setAssignFormId(String(selectedForm?.id)); setAssignMode('recurrence'); setAssignDates([]); setAssignDialogOpen(true) }}>
                <SendIcon className='size-3.5 mr-1' /> Asignar
              </Button>
              <Button size='sm' onClick={openCreateQuestion}>
                <PlusIcon className='size-3.5 mr-1' /> Añadir Pregunta
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-base'>Preguntas ({questions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {questionsLoading ? (
                <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
              ) : questions.length > 0 ? (
                <div className='space-y-2'>
                  {questions.map((q, idx) => (
                    <div key={q.id} className='rounded-lg border p-3 flex items-start justify-between gap-3 hover:border-primary/50 transition-colors'>
                      <div className='flex items-start gap-3'>
                        <div className='mt-0.5'><GripVerticalIcon className='size-4 text-muted-foreground' /></div>
                        <div>
                          <p className='text-sm font-medium'>{idx + 1}. {q.question_text}</p>
                          <div className='flex items-center gap-2 mt-1 flex-wrap'>
                            <Badge variant='outline' className='text-[10px] capitalize gap-1'>
                              <TypeIconComponent type={q.type} className='size-3' /> {TYPE_LABELS[q.type] || q.type}
                            </Badge>
                            {q.is_required && <Badge variant='secondary' className='text-[10px]'>Obligatoria</Badge>}
                            {q.type === 'multiple_choice' && q.options && (
                              <span className='text-[10px] text-muted-foreground'>{q.options.length} opciones{q.allow_multiple ? ', múltiple' : ''}</span>
                            )}
                            {q.type === 'metric' && q.metric && (
                              <span className='text-[10px] text-muted-foreground'>Se sincroniza con {q.metric.label}</span>
                            )}
                            {q.type === 'progress_photos' && (
                              <span className='text-[10px] text-muted-foreground'>Máx. {q.max_files || 1} fotos → galería</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className='flex gap-1'>
                        <Button variant='ghost' size='sm' onClick={() => openEditQuestion(q)}>
                          <PencilIcon className='size-3' />
                        </Button>
                        <Button variant='ghost' size='sm' onClick={() => handleDeleteQuestion(q.id)}>
                          <TrashIcon className='size-3 text-destructive' />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='flex flex-col items-center py-12 text-muted-foreground'>
                  <p className='text-sm'>Aún no hay preguntas.</p>
                  <Button size='sm' className='mt-3' onClick={openCreateQuestion}>
                    <PlusIcon className='size-3.5 mr-1' /> Añadir Primera Pregunta
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingForm ? 'Editar Formulario' : 'Nuevo Formulario'}</DialogTitle></DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título</FieldLabel>
              <Input value={formForm.title} onChange={e => setFormForm(prev => ({ ...prev, title: e.target.value }))} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Descripción</FieldLabel>
              <Textarea className='resize-none' rows={3} value={formForm.description} onChange={e => setFormForm(prev => ({ ...prev, description: e.target.value }))} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Tipo</FieldLabel>
              <Select value={formForm.recurrence} onValueChange={v => setFormForm(prev => ({ ...prev, recurrence: v ?? '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map(o => (
                    <SelectItem key={o.value || 'questionnaire'} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setFormDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveForm} disabled={!formForm.title.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <FileTextIcon className='size-4' />
              {editingQuestion ? 'Editar Pregunta' : 'Añadir Pregunta'}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <Field className='gap-2'>
              <FieldLabel>Pregunta</FieldLabel>
              <Input
                placeholder='Tu pregunta, p. ej. ¿Cómo te sientes hoy?'
                value={questionForm.question_text || ''}
                onChange={e => setQuestionForm(prev => ({ ...prev, question_text: e.target.value }))}
              />
            </Field>
            <div className='flex items-center gap-3'>
              <Switch checked={questionForm.is_required ?? false} onCheckedChange={v => setQuestionForm(prev => ({ ...prev, is_required: v }))} />
              <span className='text-sm'>¿Obligatoria?</span>
            </div>

            <Separator />

            <div className='space-y-2'>
              <p className='text-sm font-medium'>Tipo de pregunta</p>
              <div className='grid grid-cols-2 md:grid-cols-3 gap-2'>
                {QUESTION_TYPES.map(t => {
                  const Icon = t.icon
                  const selected = questionForm.type === t.value
                  return (
                    <button
                      key={t.value}
                      type='button'
                      onClick={() => setQuestionForm(prev => ({ ...prev, type: t.value }))}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                    >
                      <div className='mt-0.5 shrink-0'>
                        <Icon className='size-5' style={{ color: t.color }} />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${selected ? 'text-primary' : ''}`}>{t.label}</p>
                        <p className='text-[11px] text-muted-foreground leading-tight'>{t.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <Separator />

            {renderQuestionConfig()}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setQuestionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveQuestion} disabled={!questionForm.question_text?.trim()}>
              {editingQuestion ? 'Actualizar' : 'Añadir Pregunta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar Formulario</DialogTitle></DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Formulario</FieldLabel>
              <Select value={assignFormId} onValueChange={v => setAssignFormId(v ?? '')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {forms.map(f => (
                    <SelectItem key={f.id} value={String(f.id)}>{f.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Cliente</FieldLabel>
              <Select value={assignClientId} onValueChange={v => setAssignClientId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Seleccionar cliente' /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.first_name} {c.last_name} ({c.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Cuándo</FieldLabel>
              <Select value={assignMode} onValueChange={v => setAssignMode((v as 'recurrence' | 'dates') ?? 'recurrence')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='recurrence'>Según el formulario (recurrencia)</SelectItem>
                  <SelectItem value='dates'>Fecha(s) concretas</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {assignMode === 'dates' && (
              <Field className='gap-2'>
                <FieldLabel>Fechas</FieldLabel>
                <Popover>
                  <PopoverTrigger render={
                    <Button variant='outline' className='gap-2 justify-start font-normal'>
                      <CalendarDays size={16} />
                      {assignDates.length === 0
                        ? 'Elegir fecha(s)'
                        : assignDates.length === 1
                          ? format(assignDates[0], 'dd MMM yyyy', { locale: es })
                          : `${assignDates.length} fechas elegidas`}
                    </Button>
                  } />
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar
                      mode='multiple'
                      selected={assignDates}
                      onSelect={dates => setAssignDates(dates ?? [])}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
                {assignDates.length > 0 && (
                  <div className='flex flex-wrap gap-1.5'>
                    {assignDates.map((d, idx) => (
                      <Badge key={idx} variant='secondary' className='gap-1'>
                        {format(d, 'dd MMM', { locale: es })}
                        <button type='button' onClick={() => setAssignDates(prev => prev.filter((_, i) => i !== idx))}>
                          <XIcon className='size-3' />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!assignFormId || !assignClientId || (assignMode === 'dates' && assignDates.length === 0)}>Asignar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader><DialogTitle>Comentario del entrenador</DialogTitle></DialogHeader>
          {feedbackSubmission && (
            <div className='space-y-4'>
              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div>
                  <p className='text-muted-foreground'>Formulario</p>
                  <p className='font-medium'>{feedbackSubmission.form_assignment?.form?.title}</p>
                </div>
                <div>
                  <p className='text-muted-foreground'>Cliente</p>
                  <p className='font-medium'>{feedbackSubmission.form_assignment?.client?.first_name} {feedbackSubmission.form_assignment?.client?.last_name}</p>
                </div>
              </div>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>Respuestas</p>
                {feedbackSubmission.answers?.map(a => (
                  <div key={a.id} className='rounded border p-2'>
                    <p className='text-xs text-muted-foreground'>{a.question?.question_text}</p>
                    <p className='text-sm font-medium'>{a.answer_value ?? '—'}</p>
                  </div>
                ))}
              </div>
              <Field className='gap-2'>
                <FieldLabel>Comentario</FieldLabel>
                <Textarea className='resize-none' rows={4} value={feedbackText} onChange={e => setFeedbackText(e.target.value)} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setFeedbackDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveFeedback}>Guardar Comentario</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
