import { useState, useEffect, useCallback, useMemo } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, ExternalLinkIcon, Code2Icon, ClipboardListIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type TaskType = 'management' | 'dev'

type Task = {
  id: number
  type: TaskType
  title: string
  description: string | null
  due_date: string | null
  priority: 'low' | 'medium' | 'high' | null
  status: 'pending' | 'in_progress' | 'completed'
  category: 'entrenamiento' | 'nutricion' | 'revisiones' | 'otro' | null
  source_repo: string | null
  source_url: string | null
  author?: { id: number; first_name: string; last_name: string }
  client?: { id: number; first_name: string; last_name: string; email: string } | null
  created_at: string
}

type Client = { id: number; first_name: string; last_name: string; email: string }

const PRIORITY_CONFIG = {
  low: { label: 'Baja', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  medium: { label: 'Media', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  high: { label: 'Alta', color: 'bg-red-100 text-red-700 border-red-200' },
}

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'secondary' as const },
  in_progress: { label: 'En progreso', color: 'default' as const },
  completed: { label: 'Completada', color: 'default' as const },
}

const CATEGORY_LABELS: Record<string, string> = {
  entrenamiento: 'Entrenamiento',
  nutricion: 'Nutrición',
  revisiones: 'Revisiones',
  otro: 'Otro',
}

const TasksView = () => {
  // "Gestión" (a mano) vs "Desarrollo" (sincronizada por Claude Code desde
  // docs/ROADMAP.md de bsa, ver TaskController::sync() en Bckbs) -- misma
  // tabla `tasks`, filtradas por `type` en el backend.
  const [typeTab, setTypeTab] = useState<TaskType>('management')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [clients, setClients] = useState<Client[]>([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    due_date: '',
    priority: 'medium' as string,
    status: 'pending' as string,
    category: '__none__' as string,
  })

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100', type: typeTab })
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (typeTab === 'management' && categoryFilter !== 'all') params.set('category', categoryFilter)
      const res = await api.get(`/admin/task-list?${params}`)
      setTasks(res.data?.data || [])
    } catch {
      toast.error('No se pudieron cargar las tareas')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, categoryFilter, typeTab])

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/admin/users?per_page=500')
      setClients(res.data || [])
    } catch {
      // best-effort fetch, ignore failures
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])
  useEffect(() => { fetchClients() }, [fetchClients])

  const openCreate = () => {
    setEditingTask(null)
    setFormData({ title: '', description: '', client_id: '', due_date: '', priority: 'medium', status: 'pending', category: '__none__' })
    setDialogOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description || '',
      client_id: task.client ? String(task.client.id) : '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      priority: task.priority || 'medium',
      status: task.status,
      category: task.category || '__none__',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) { toast.error('El título es obligatorio'); return }
    setSubmitting(true)
    try {
      const payload: any = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        client_id: formData.client_id ? Number(formData.client_id) : null,
        due_date: formData.due_date || null,
        priority: formData.priority,
        status: formData.status,
        category: formData.category === '__none__' ? null : formData.category,
      }

      if (editingTask) {
        payload.id = editingTask.id
        const res = await api.post('/admin/task-update', payload)
        setTasks(prev => prev.map(t => t.id === editingTask.id ? (res.data?.data || res.data) : t))
        toast.success('Tarea actualizada')
      } else {
        const res = await api.post('/admin/task-store', payload)
        setTasks(prev => [res.data?.data || res.data, ...prev])
        toast.success('Tarea creada')
      }
      setDialogOpen(false)
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar la tarea')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingTask) return
    try {
      await api.post('/admin/task-delete', { id: deletingTask.id })
      setTasks(prev => prev.filter(t => t.id !== deletingTask.id))
      toast.success('Tarea eliminada')
      setDeleteDialogOpen(false)
      setDeletingTask(null)
    } catch {
      toast.error('No se pudo eliminar la tarea')
    }
  }

  const handleQuickStatus = async (task: Task, newStatus: string) => {
    try {
      const res = await api.post('/admin/task-update', { id: task.id, status: newStatus })
      setTasks(prev => prev.map(t => t.id === task.id ? (res.data?.data || res.data) : t))
      toast.success(`Tarea marcada como ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}`)
    } catch {
      toast.error('No se pudo actualizar el estado')
    }
  }

  const now = useMemo(() => new Date(), [])

  const isOverdue = useCallback((task: Task) => {
    if (!task.due_date || task.status === 'completed') return false
    return new Date(task.due_date) < new Date(now.toDateString())
  }, [now])

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(isOverdue).length,
  }), [tasks, isOverdue])

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <h1 className='text-xl font-semibold'>Tareas</h1>
        {typeTab === 'management' && (
          <Button onClick={openCreate}>
            <PlusIcon className='size-4 mr-1' /> Nueva tarea
          </Button>
        )}
      </div>

      {/* Gestión (a mano) vs Desarrollo (sincronizada por Claude Code desde
          docs/ROADMAP.md de bsa) -- misma tabla, filtrada por `type`. */}
      <div className='inline-flex rounded-lg border p-1 bg-muted/40'>
        <button
          type='button'
          onClick={() => setTypeTab('management')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            typeTab === 'management' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <ClipboardListIcon className='size-3.5' /> Gestión
        </button>
        <button
          type='button'
          onClick={() => setTypeTab('dev')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            typeTab === 'dev' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Code2Icon className='size-3.5' /> Desarrollo
        </button>
      </div>

      <div className='grid grid-cols-2 md:grid-cols-5 gap-3'>
        <Card className='p-3'>
          <p className='text-2xl font-bold'>{stats.total}</p>
          <p className='text-xs text-muted-foreground'>Total</p>
        </Card>
        <Card className='p-3'>
          <p className='text-2xl font-bold text-yellow-600'>{stats.pending}</p>
          <p className='text-xs text-muted-foreground'>Pendiente</p>
        </Card>
        <Card className='p-3'>
          <p className='text-2xl font-bold text-blue-600'>{stats.inProgress}</p>
          <p className='text-xs text-muted-foreground'>En progreso</p>
        </Card>
        <Card className='p-3'>
          <p className='text-2xl font-bold text-green-600'>{stats.completed}</p>
          <p className='text-xs text-muted-foreground'>Completada</p>
        </Card>
        <Card className='p-3'>
          <p className='text-2xl font-bold text-red-600'>{stats.overdue}</p>
          <p className='text-xs text-muted-foreground'>Vencida</p>
        </Card>
      </div>

      <div className='flex items-center gap-3'>
        <Input
          placeholder='Buscar tareas...'
          value={search}
          onChange={e => setSearch(e.target.value)}
          className='max-w-sm'
        />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className='w-[160px]'>
            <SelectValue placeholder='Todos los estados' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos los estados</SelectItem>
            <SelectItem value='pending'>Pendiente</SelectItem>
            <SelectItem value='in_progress'>En progreso</SelectItem>
            <SelectItem value='completed'>Completada</SelectItem>
          </SelectContent>
        </Select>
        {typeTab === 'management' && (
          <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v ?? 'all')}>
            <SelectTrigger className='w-[160px]'>
              <SelectValue placeholder='Todas las categorías' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todas las categorías</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className='p-0'>
          {loading ? (
            <div className='flex items-center justify-center py-20'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : tasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[40%]'>Tarea</TableHead>
                  {typeTab === 'management' ? (
                    <>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha límite</TableHead>
                      <TableHead className='text-right'>Acciones</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Estado</TableHead>
                      <TableHead>Origen</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(task => {
                  const overdue = isOverdue(task)
                  return (
                    <TableRow key={task.id} className={overdue ? 'bg-red-50/50' : ''}>
                      <TableCell>
                        <div>
                          <p className='font-medium text-sm'>{task.title}</p>
                          {task.description && (
                            <p className='text-xs text-muted-foreground truncate max-w-[300px]'>{task.description}</p>
                          )}
                        </div>
                      </TableCell>
                      {typeTab === 'management' ? (
                        <>
                          <TableCell>
                            {task.client ? (
                              <span className='text-sm'>{task.client.first_name} {task.client.last_name}</span>
                            ) : (
                              <span className='text-xs text-muted-foreground'>—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {task.category ? (
                              <Badge variant='outline'>{CATEGORY_LABELS[task.category] || task.category}</Badge>
                            ) : (
                              <span className='text-xs text-muted-foreground'>—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.color || ''}`}>
                              {PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG]?.label || task.priority}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.color || 'secondary'}
                              className='cursor-pointer'
                              onClick={() => {
                                const next = task.status === 'completed' ? 'pending' : task.status === 'pending' ? 'in_progress' : 'completed'
                                handleQuickStatus(task, next)
                              }}
                            >
                              {STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.label || task.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {task.due_date ? (
                              <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                {new Date(task.due_date).toLocaleDateString()}
                                {overdue && ' (vencida)'}
                              </span>
                            ) : (
                              <span className='text-xs text-muted-foreground'>—</span>
                            )}
                          </TableCell>
                          <TableCell className='text-right'>
                            <div className='flex items-center justify-end gap-1'>
                              <Button variant='ghost' size='sm' onClick={() => openEdit(task)}>
                                <PencilIcon className='size-3.5' />
                              </Button>
                              <Button variant='ghost' size='sm' onClick={() => { setDeletingTask(task); setDeleteDialogOpen(true) }}>
                                <TrashIcon className='size-3.5 text-destructive' />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <Badge
                              variant={STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.color || 'secondary'}
                              className='cursor-pointer'
                              onClick={() => {
                                const next = task.status === 'completed' ? 'pending' : task.status === 'pending' ? 'in_progress' : 'completed'
                                handleQuickStatus(task, next)
                              }}
                            >
                              {STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG]?.label || task.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className='flex items-center gap-2'>
                              {task.source_repo && <span className='text-xs text-muted-foreground font-mono'>{task.source_repo}</span>}
                              {task.source_url && (
                                <a href={task.source_url} target='_blank' rel='noreferrer' className='text-primary hover:underline'>
                                  <ExternalLinkIcon className='size-3.5' />
                                </a>
                              )}
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className='flex flex-col items-center py-12 text-muted-foreground'>
              <CheckCircleIcon className='size-12 mb-4 opacity-50' />
              <p className='font-medium'>No hay tareas</p>
              <p className='text-sm'>
                {typeTab === 'management'
                  ? 'Crea la primera tarea para comenzar.'
                  : 'Claude Code sincroniza aquí los items pendientes de docs/ROADMAP.md.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título *</FieldLabel>
              <Input
                placeholder='Título de la tarea'
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Descripción</FieldLabel>
              <Textarea
                placeholder='Descripción opcional'
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className='resize-none'
              />
            </Field>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Asignar a cliente</FieldLabel>
                <Select value={formData.client_id} onValueChange={v => setFormData(prev => ({ ...prev, client_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder='Sin cliente (general)' /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.first_name} {c.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Fecha límite</FieldLabel>
                <Input
                  type='date'
                  value={formData.due_date}
                  onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </Field>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Prioridad</FieldLabel>
                <Select value={formData.priority} onValueChange={v => setFormData(prev => ({ ...prev, priority: v ?? 'medium' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='low'>Baja</SelectItem>
                    <SelectItem value='medium'>Media</SelectItem>
                    <SelectItem value='high'>Alta</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Estado</FieldLabel>
                <Select value={formData.status} onValueChange={v => setFormData(prev => ({ ...prev, status: v ?? 'pending' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='pending'>Pendiente</SelectItem>
                    <SelectItem value='in_progress'>En progreso</SelectItem>
                    <SelectItem value='completed'>Completada</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field className='gap-2'>
              <FieldLabel>Categoría</FieldLabel>
              <Select value={formData.category} onValueChange={v => setFormData(prev => ({ ...prev, category: v ?? '__none__' }))}>
                <SelectTrigger><SelectValue placeholder='Sin categoría' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin categoría</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting || !formData.title.trim()}>
              {submitting ? 'Guardando...' : editingTask ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar tarea</DialogTitle>
          </DialogHeader>
          <p className='text-sm text-muted-foreground'>
            ¿Estás seguro de que quieres eliminar <strong>{deletingTask?.title}</strong>? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TasksView
