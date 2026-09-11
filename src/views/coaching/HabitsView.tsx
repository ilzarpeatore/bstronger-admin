import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, Trash2Icon, PencilIcon, UserPlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { HABIT_ICONS, habitIconFor, type HabitIconKey } from '@/lib/habitIcons'
import { HABIT_CATEGORIES, groupByCategory } from '@/lib/habitCategories'
import HabitDialog from '@/components/coaching/HabitDialog'
import HabitProgressPanel, { type HabitProgressItem } from '@/components/coaching/HabitProgressPanel'

type Frequency = 'daily' | 'weekly'

type Habit = {
  id: number
  title: string
  icon: string | null
  target_value: number | string | null
  target_unit: string | null
  frequency: Frequency
  source_type?: 'coach_assigned' | 'library' | 'personal' | null
  current_streak?: number
  logs?: HabitLogEntry[]
}

type HabitLogEntry = { date: string; is_completed: boolean; value_logged?: number | string | null }

type HabitTemplate = {
  id: number
  title: string
  icon: string | null
  category?: string | null
  target_value: number | string | null
  target_unit: string | null
  frequency: Frequency
  adopted_count: number
}

type HabitFormData = {
  icon: HabitIconKey | ''
  title: string
  target_value: string
  target_unit: string
  frequency: Frequency
}

const INITIAL_FORM: HabitFormData = { icon: '', title: '', target_value: '', target_unit: 'veces', frequency: 'daily' }

type SelectOption = { id: number; label: string }

const GOAL_UNITS = ['veces', 'min', 'horas', 'vasos', 'km', 'pasos', 'sesiones', 'páginas', 'reps']

const PROGRESS_DAYS = 371

function formatGoal(h: { target_value: Habit['target_value']; target_unit: string | null; frequency: Frequency }) {
  if (!h.target_value || !h.target_unit) return null
  return `${h.target_value} ${h.target_unit} / ${h.frequency === 'daily' ? 'día' : 'semana'}`
}

function IconPicker({ value, onChange }: { value: HabitIconKey | ''; onChange: (k: HabitIconKey) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div className="flex size-10 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 transition-colors hover:border-violet-400 hover:bg-violet-50">
          {(() => { const Icon = habitIconFor(value); return <Icon className="size-5 text-muted-foreground" /> })()}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="grid grid-cols-5 gap-1 p-2 w-[240px] max-h-[280px] overflow-y-auto">
        {HABIT_ICONS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            title={label}
            className={cn('size-9 flex items-center justify-center rounded-lg hover:bg-violet-50 hover:ring-1 hover:ring-violet-200 transition-all', value === key && 'bg-violet-100 ring-1 ring-violet-300')}
            onClick={() => onChange(key)}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const HabitsView = () => {
  const [clients, setClients] = useState<SelectOption[]>([])
  const [clientId, setClientId] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<HabitProgressItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HabitProgressItem | null>(null)

  // Progreso real del cliente seleccionado (todos sus hábitos: asignados + biblioteca + personales)
  const [progress, setProgress] = useState<HabitProgressItem[]>([])
  const [loadingProgress, setLoadingProgress] = useState(false)

  // Biblioteca global (plantillas visibles/adoptables por todos los clientes desde la app)
  const [templates, setTemplates] = useState<HabitTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<HabitTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState<HabitFormData & { category: string }>({ ...INITIAL_FORM, category: HABIT_CATEGORIES[0] })
  const [templateSubmitting, setTemplateSubmitting] = useState(false)
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<HabitTemplate | null>(null)

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/admin/users?per_page=500')
      const data = res.data?.data || res.data || []
      setClients(data.map((u: any) => ({ id: u.id, label: `${u.name || u.display_name || (u.first_name + ' ' + u.last_name)} (${u.email})` })))
    } catch {
      toast.error('Error al cargar los clientes')
    }
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  const fetchProgress = useCallback(async (id: string) => {
    if (!id) { setProgress([]); return }
    setLoadingProgress(true)
    try {
      const res = await api.get(`/admin/client-habit-progress?client_id=${id}&days=${PROGRESS_DAYS}`)
      setProgress(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar el progreso del cliente')
    } finally {
      setLoadingProgress(false)
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true)
    try {
      const res = await api.get('/admin/habit-list?templates=1')
      setTemplates(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar la biblioteca de hábitos')
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  // Al elegir cliente en el selector, se recarga TODO lo que depende de él —
  // antes esto no pasaba nunca (bug real: el selector no filtraba nada).
  useEffect(() => {
    if (!clientId && clients.length > 0) {
      setClientId(String(clients[0].id))
      return
    }
    fetchProgress(clientId)
  }, [clientId, clients, fetchProgress])

  const openCreate = () => {
    setEditingHabit(null)
    setDialogOpen(true)
  }

  const openEdit = (habit: HabitProgressItem) => {
    setEditingHabit(habit)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.post('/admin/habit-delete', { id: deleteTarget.id })
      toast.success('Hábito eliminado')
      setDeleteTarget(null)
      fetchProgress(clientId)
    } catch {
      toast.error('Error al eliminar')
    }
  }

  // ═══ Biblioteca global (plantillas) ═══════════════════════════════════
  const openCreateTemplate = () => {
    setEditingTemplate(null)
    setTemplateForm({ ...INITIAL_FORM, category: HABIT_CATEGORIES[0] })
    setTemplateDialogOpen(true)
  }

  const openEditTemplate = (t: HabitTemplate) => {
    setEditingTemplate(t)
    setTemplateForm({
      icon: (t.icon as HabitIconKey) || '',
      title: t.title,
      target_value: t.target_value != null ? String(t.target_value) : '',
      target_unit: t.target_unit || 'veces',
      frequency: t.frequency,
      category: t.category || HABIT_CATEGORIES[0],
    })
    setTemplateDialogOpen(true)
  }

  const handleTemplateSubmit = async () => {
    if (!templateForm.title.trim()) { toast.error('El nombre del hábito es obligatorio'); return }
    setTemplateSubmitting(true)
    try {
      const payload = {
        icon: templateForm.icon || null,
        category: templateForm.category || null,
        title: templateForm.title.trim(),
        target_value: templateForm.target_value ? Number(templateForm.target_value) : null,
        target_unit: templateForm.target_value ? templateForm.target_unit : null,
        frequency: templateForm.frequency,
      }
      if (editingTemplate) {
        await api.post('/admin/habit-template-update', { id: editingTemplate.id, ...payload })
        toast.success('Hábito de biblioteca actualizado')
      } else {
        await api.post('/admin/habit-template-store', payload)
        toast.success('Hábito añadido a la biblioteca — ya es visible para todos los clientes en la app')
      }
      setTemplateDialogOpen(false)
      fetchTemplates()
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar')
    } finally {
      setTemplateSubmitting(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateTarget) return
    try {
      await api.post('/admin/habit-template-delete', { id: deleteTemplateTarget.id })
      toast.success('Eliminado de la biblioteca')
      setDeleteTemplateTarget(null)
      fetchTemplates()
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const handleQuickAssign = async (t: HabitTemplate) => {
    if (!clientId) { toast.error('Selecciona un cliente primero'); return }
    try {
      await api.post('/admin/habit-store', {
        icon: t.icon, title: t.title, target_value: t.target_value, target_unit: t.target_unit,
        frequency: t.frequency, client_id: Number(clientId),
      })
      toast.success(`"${t.title}" asignado directamente al cliente`)
      fetchProgress(clientId)
    } catch (err: any) {
      toast.error(err?.message || 'Error al asignar')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Hábitos y progreso por cliente</CardTitle>
            <CardDescription>Hábitos asignados directamente + progreso real (incluye los de biblioteca y personales)</CardDescription>
          </div>
          <Select value={clientId} onValueChange={v => setClientId(v ?? '')}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Seleccionar un cliente" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Progreso real — toca un hábito para ver su semana, mes, trimestre, semestre o año</p>
              <Button size="sm" onClick={openCreate} disabled={!clientId}>
                <PlusIcon className="size-4 mr-2" /> Añadir hábito
              </Button>
            </div>
            <HabitProgressPanel
              items={progress}
              loading={loadingProgress}
              emptyLabel={clientId ? 'Este cliente todavía no tiene ningún hábito en marcha.' : 'Selecciona un cliente'}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Biblioteca global de hábitos</CardTitle>
            <CardDescription>Visibles y adoptables por todos los clientes desde la app — no dependen de que tú los asignes uno a uno</CardDescription>
          </div>
          <Button size="sm" onClick={openCreateTemplate}><PlusIcon className="size-4 mr-2" /> Añadir a la biblioteca</Button>
        </CardHeader>
        <CardContent>
          {loadingTemplates ? (
            <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Todavía no hay hábitos en la biblioteca global.</p>
          ) : (
            <div className="space-y-5">
              {groupByCategory(templates).map(([category, items]) => (
                <div key={category}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map(t => {
                      const Icon = habitIconFor(t.icon)
                      return (
                        <div key={t.id} className="group relative rounded-lg border p-3 hover:border-violet-200 hover:bg-violet-50/40 transition-colors">
                          <div className="flex items-start gap-2.5">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600 shrink-0"><Icon className="size-4" /></div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{t.title}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{formatGoal(t) || 'Sin objetivo numérico'}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{t.adopted_count} cliente{t.adopted_count === 1 ? '' : 's'} lo tiene{t.adopted_count === 1 ? '' : 'n'} activo</p>
                            </div>
                          </div>
                          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {clientId && (
                              <button type="button" title="Asignar directo al cliente seleccionado" onClick={() => handleQuickAssign(t)} className="flex size-6 items-center justify-center rounded-md bg-violet-600 text-white"><UserPlusIcon className="size-3.5" /></button>
                            )}
                            <button type="button" title="Editar" onClick={() => openEditTemplate(t)} className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground hover:text-foreground"><PencilIcon className="size-3.5" /></button>
                            <button type="button" title="Eliminar de la biblioteca" onClick={() => setDeleteTemplateTarget(t)} className="flex size-6 items-center justify-center rounded-md bg-muted text-destructive"><Trash2Icon className="size-3.5" /></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog compartido: asignar hábito a este cliente, a mano o desde la biblioteca real */}
      <HabitDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={Number(clientId)}
        editingHabit={editingHabit}
        onSaved={() => { setDialogOpen(false); fetchProgress(clientId) }}
      />

      {/* Dialog: crear/editar plantilla de biblioteca global */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>{editingTemplate ? 'Editar hábito de biblioteca' : 'Nuevo hábito de biblioteca'}</DialogTitle></DialogHeader>
          {renderFormFields(templateForm, setTemplateForm)}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Categoría</label>
            <Select value={templateForm.category} onValueChange={v => setTemplateForm(p => ({ ...p, category: v ?? p.category }))}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HABIT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTemplateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleTemplateSubmit} disabled={templateSubmitting || !templateForm.title.trim()} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
              {templateSubmitting ? 'Guardando...' : editingTemplate ? 'Actualizar' : 'Añadir a la biblioteca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar hábito</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">¿Seguro que quieres eliminar "{deleteTarget?.title}"? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTemplateTarget} onOpenChange={(o) => !o && setDeleteTemplateTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar de la biblioteca</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            ¿Seguro que quieres eliminar "{deleteTemplateTarget?.title}" de la biblioteca global?
            {!!deleteTemplateTarget?.adopted_count && ` ${deleteTemplateTarget.adopted_count} cliente(s) que ya lo adoptaron conservan su historial, pero dejará de estar disponible para nuevas adopciones.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTemplateTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteTemplate}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function renderFormFields<T extends HabitFormData>(data: T, setData: (updater: (p: T) => T) => void) {
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-start gap-3">
        <IconPicker value={data.icon} onChange={(k) => setData(p => ({ ...p, icon: k }))} />
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium">Nombre <span className="text-destructive">*</span></label>
          <Input
            value={data.title}
            onChange={e => setData(p => ({ ...p, title: e.target.value }))}
            placeholder="p. ej. Beber agua"
            maxLength={50}
            className="h-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center border rounded-lg overflow-hidden">
          <Input
            type="number"
            value={data.target_value}
            onChange={e => setData(p => ({ ...p, target_value: e.target.value }))}
            placeholder="Objetivo"
            className="w-24 border-0 rounded-none text-center font-semibold h-9"
          />
          <div className="w-px h-5 bg-border" />
          <Select value={data.target_unit} onValueChange={v => setData(p => ({ ...p, target_unit: v ?? 'veces' }))}>
            <SelectTrigger className="w-[100px] rounded-none border-0 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GOAL_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <span className="text-muted-foreground/40">/</span>

        <div className="flex rounded-lg border overflow-hidden">
          {(['daily', 'weekly'] as Frequency[]).map(f => (
            <button
              key={f}
              type="button"
              className={cn('px-4 py-1.5 text-xs font-medium transition-all', data.frequency === f ? 'bg-violet-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted')}
              onClick={() => setData(p => ({ ...p, frequency: f }))}
            >
              {f === 'daily' ? 'Diario' : 'Semanal'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HabitsView
