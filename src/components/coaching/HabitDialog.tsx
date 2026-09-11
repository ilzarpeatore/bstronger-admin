import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, XIcon, TargetIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { HABIT_ICONS, habitIconFor, type HabitIconKey } from '@/lib/habitIcons'
import { groupByCategory } from '@/lib/habitCategories'

export type Habit = {
  id: number
  title: string
  icon: string | null
  target_value: number | string | null
  target_unit: string | null
  frequency: 'daily' | 'weekly'
  source_type?: 'coach_assigned' | 'library' | 'personal' | null
  current_streak?: number
}

export type HabitTemplate = {
  id: number
  title: string
  icon: string | null
  category?: string | null
  target_value: number | string | null
  target_unit: string | null
  frequency: 'daily' | 'weekly'
  adopted_count?: number
}

export type HabitFormData = {
  icon: HabitIconKey | ''
  title: string
  target_value: string
  target_unit: string
  frequency: 'daily' | 'weekly'
}

const INITIAL_FORM: HabitFormData = { icon: '', title: '', target_value: '', target_unit: 'veces', frequency: 'daily' }
const GOAL_UNITS = ['veces', 'min', 'horas', 'vasos', 'km', 'pasos', 'sesiones', 'páginas', 'reps']

type HabitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: number
  editingHabit: Habit | null
  onSaved: () => void
}

function formatGoal(t: { target_value: HabitTemplate['target_value']; target_unit: string | null; frequency: 'daily' | 'weekly' }) {
  if (!t.target_value || !t.target_unit) return null
  return `${t.target_value} ${t.target_unit} / ${t.frequency === 'daily' ? 'día' : 'semana'}`
}

/**
 * Diálogo compartido por /habits y /users/:id/habitos — asigna un hábito
 * directo a `clientId`, a mano o eligiéndolo de la biblioteca global real
 * (pestaña "Biblioteca", agrupada por categoría). La biblioteca en sí se
 * gestiona (crear/editar/borrar plantillas) desde la Card "Biblioteca
 * global de hábitos" de HabitsView.tsx — este diálogo solo la consulta.
 */
export default function HabitDialog({ open, onOpenChange, clientId, editingHabit, onSaved }: HabitDialogProps) {
  const [tab, setTab] = useState<'new' | 'library'>('new')
  const [formData, setFormData] = useState<HabitFormData>(editingHabit ? {
    icon: (editingHabit.icon as HabitIconKey) || '',
    title: editingHabit.title,
    target_value: editingHabit.target_value != null ? String(editingHabit.target_value) : '',
    target_unit: editingHabit.target_unit || 'veces',
    frequency: editingHabit.frequency,
  } : { ...INITIAL_FORM })
  const [submitting, setSubmitting] = useState(false)

  const [templates, setTemplates] = useState<HabitTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [assigningId, setAssigningId] = useState<number | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true)
    try {
      const res = await api.get('/admin/habit-list?templates=1')
      setTemplates(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar la biblioteca')
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setTab('new')
      setFormData(editingHabit ? {
        icon: (editingHabit.icon as HabitIconKey) || '',
        title: editingHabit.title,
        target_value: editingHabit.target_value != null ? String(editingHabit.target_value) : '',
        target_unit: editingHabit.target_unit || 'veces',
        frequency: editingHabit.frequency,
      } : { ...INITIAL_FORM })
      if (!editingHabit) fetchTemplates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingHabit])

  const handleSubmit = async () => {
    if (!formData.title.trim()) { toast.error('El nombre del hábito es obligatorio'); return }
    setSubmitting(true)
    try {
      const payload = {
        icon: formData.icon || null,
        title: formData.title.trim(),
        target_value: formData.target_value ? Number(formData.target_value) : null,
        target_unit: formData.target_value ? formData.target_unit : null,
        frequency: formData.frequency,
        client_id: clientId,
      }
      if (editingHabit) {
        await api.post('/admin/habit-update', { id: editingHabit.id, ...payload })
        toast.success('Hábito actualizado')
      } else {
        await api.post('/admin/habit-store', payload)
        toast.success('Hábito creado')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar el hábito')
    } finally {
      setSubmitting(false)
    }
  }

  const pickFromLibrary = (t: HabitTemplate) => {
    setFormData({
      icon: (t.icon as HabitIconKey) || '',
      title: t.title,
      target_value: t.target_value != null ? String(t.target_value) : '',
      target_unit: t.target_unit || 'veces',
      frequency: t.frequency,
    })
    setTab('new')
  }

  const quickAssign = async (t: HabitTemplate) => {
    if (assigningId) return
    setAssigningId(t.id)
    try {
      await api.post('/admin/habit-store', {
        icon: t.icon, title: t.title, target_value: t.target_value, target_unit: t.target_unit,
        frequency: t.frequency, client_id: clientId,
      })
      toast.success(`"${t.title}" asignado`)
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo asignar')
    } finally {
      setAssigningId(null)
    }
  }

  const grouped = groupByCategory(templates)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex flex-col p-0 gap-0 overflow-hidden rounded-2xl' style={{ width: '700px', maxWidth: '700px', maxHeight: '82vh' }}>
        <div className='bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-4 shrink-0'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='flex size-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20'><TargetIcon className='size-4.5 text-white' /></div>
              <DialogTitle className='text-base font-semibold text-white'>{editingHabit ? 'Editar hábito' : 'Nuevo hábito para este cliente'}</DialogTitle>
            </div>
            <Button variant='ghost' size='icon-sm' className='text-white/70 hover:text-white hover:bg-white/10' onClick={() => onOpenChange(false)}><XIcon className='size-4' /></Button>
          </div>
        </div>

        {editingHabit ? (
          <div className='px-6 py-4'>{renderFormFields(formData, setFormData)}</div>
        ) : (
          <Tabs value={tab} onValueChange={v => v && setTab(v as 'new' | 'library')} className='flex flex-1 flex-col px-6 overflow-hidden min-h-0'>
            <div className='-mx-6 border-b shrink-0'>
              <TabsList className='px-6'>
                <TabsTrigger value='new' className='pb-2.5 pt-3 text-sm data-selected:font-semibold'>Nuevo hábito</TabsTrigger>
                <TabsTrigger value='library' className='pb-2.5 pt-3 text-sm data-selected:font-semibold'>Biblioteca de hábitos</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value='new' className='py-4 flex-1 overflow-y-auto'>
              {renderFormFields(formData, setFormData)}
            </TabsContent>

            <TabsContent value='library' className='flex flex-col flex-1 overflow-hidden'>
              <div className='flex-1 overflow-y-auto space-y-5 py-3'>
                {loadingTemplates ? (
                  <div className='flex justify-center py-12'><div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                ) : templates.length === 0 ? (
                  <p className='text-sm text-muted-foreground text-center py-12'>Todavía no hay hábitos en la biblioteca global. Créalos desde la sección "Biblioteca global de hábitos".</p>
                ) : (
                  grouped.map(([category, items]) => (
                    <div key={category}>
                      <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2'>{category}</p>
                      <div className='grid grid-cols-2 gap-2'>
                        {items.map(t => {
                          const Icon = habitIconFor(t.icon)
                          return (
                            <div key={t.id} className='group relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors hover:border-violet-200 hover:bg-violet-50/50'>
                              <button type='button' className='flex flex-1 items-center gap-2.5 min-w-0 text-left' onClick={() => pickFromLibrary(t)}>
                                <Icon className='size-4.5 text-violet-600 shrink-0' />
                                <div className='min-w-0'>
                                  <p className='text-sm font-medium truncate'>{t.title}</p>
                                  <p className='text-[11px] text-muted-foreground truncate'>{formatGoal(t) || 'Sin objetivo'}</p>
                                </div>
                              </button>
                              <button
                                type='button'
                                title='Asignar directo a este cliente'
                                onClick={() => quickAssign(t)}
                                disabled={assigningId === t.id}
                                className='absolute right-2 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-md bg-violet-600 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50'
                              >
                                {assigningId === t.id ? <div className='size-3 animate-spin rounded-full border-2 border-white border-t-transparent' /> : <PlusIcon className='size-3.5' />}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <p className='text-[11px] text-muted-foreground border-t pt-3 -mx-6 px-6 shrink-0'>Toca un hábito para personalizarlo antes de asignar, o el botón + para asignarlo tal cual.</p>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className='px-6 py-3 border-t shrink-0'>
          <Button variant='ghost' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !formData.title.trim()}
            className='bg-gradient-to-r from-violet-600 to-indigo-600 text-white'
          >
            {submitting ? 'Guardando...' : editingHabit ? 'Actualizar' : 'Añadir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function renderFormFields(formData: HabitFormData, setFormData: React.Dispatch<React.SetStateAction<HabitFormData>>) {
  return (
    <div className='space-y-4'>
      <div className='flex items-start gap-3'>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className='flex size-10 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 transition-colors hover:border-violet-400 hover:bg-violet-50'>
              {(() => { const Icon = habitIconFor(formData.icon); return <Icon className='size-5 text-muted-foreground' /> })()}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className='grid grid-cols-5 gap-1 p-2 w-[240px] max-h-[280px] overflow-y-auto'>
            {HABIT_ICONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type='button'
                title={label}
                className={cn('size-9 flex items-center justify-center rounded-lg hover:bg-violet-50 hover:ring-1 hover:ring-violet-200 transition-all', formData.icon === key && 'bg-violet-100 ring-1 ring-violet-300')}
                onClick={() => setFormData(p => ({ ...p, icon: key }))}
              >
                <Icon className='size-4' />
              </button>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className='flex-1 space-y-1'>
          <label className='text-xs font-medium'>Nombre <span className='text-destructive'>*</span></label>
          <Input
            value={formData.title}
            onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
            placeholder='p. ej. Beber agua'
            maxLength={50}
            className='h-9'
          />
        </div>
      </div>

      <div className='flex items-center gap-3 flex-wrap'>
        <div className='flex items-center border rounded-lg overflow-hidden'>
          <Input
            type='number'
            value={formData.target_value}
            onChange={e => setFormData(p => ({ ...p, target_value: e.target.value }))}
            placeholder='Objetivo'
            className='w-24 border-0 rounded-none text-center font-semibold h-9'
          />
          <div className='w-px h-5 bg-border' />
          <Select value={formData.target_unit} onValueChange={v => setFormData(p => ({ ...p, target_unit: v ?? 'veces' }))}>
            <SelectTrigger className='w-[100px] rounded-none border-0 h-9'><SelectValue /></SelectTrigger>
            <SelectContent>
              {GOAL_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <span className='text-muted-foreground/40'>/</span>

        <div className='flex rounded-lg border overflow-hidden'>
          {(['daily', 'weekly'] as const).map(f => (
            <button
              key={f}
              type='button'
              className={cn('px-4 py-1.5 text-xs font-medium transition-all', formData.frequency === f ? 'bg-violet-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted')}
              onClick={() => setFormData(p => ({ ...p, frequency: f }))}
            >
              {f === 'daily' ? 'Diario' : 'Semanal'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
