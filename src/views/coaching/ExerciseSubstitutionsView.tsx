import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Plus, Pencil, Trash2, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CoachOption } from '@/lib/coachExceptions'

// Sustituciones de ejercicio -- alimenta la acción "sustituir_ejercicio" del
// Motor de Auto-Regulación de Carga (ver ProgressionRulesView.tsx). Nunca
// existió pantalla de administración para esto, solo se creaban por API
// directa. Patrón visual/código calcado de ProgressionRulesView.tsx
// (selector de coach, fetch de apoyo de ejercicios, diálogos, deleteTarget).

type ExerciseOption = { id: number; label: string }

// Únicas dos categorías que el motor usa hoy como "motivo inferido" para
// elegir una sustitución (ver TEMPLATES/REASON_LABELS en
// ProgressionRulesView.tsx: sustitucion_propuesta). El campo es texto libre
// en BD -- se limita la UI a estos 3 valores para no generar basura.
const CATEGORY_OPTIONS = [
  { value: 'estancamiento', label: 'Estancamiento' },
  { value: 'fatiga', label: 'Fatiga' },
  { value: '__generic__', label: 'Genérico (sin categoría)' },
] as const

const CATEGORY_LABELS: Record<string, string> = {
  estancamiento: 'Estancamiento',
  fatiga: 'Fatiga',
}

type SubstitutionItem = {
  id: number
  coach_id: number
  original_exercise_id: number
  substitute_exercise_id: number
  category: string | null
  carga_ratio: number | null
  original_exercise: { id: number; title: string }
  substitute_exercise: { id: number; title: string }
}

type SubstitutionForm = {
  original_exercise_id: string
  substitute_exercise_id: string
  category: string
  carga_ratio: string
}

const blankForm = (): SubstitutionForm => ({
  original_exercise_id: '', substitute_exercise_id: '', category: '__generic__', carga_ratio: '',
})

const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s))

const ExerciseSubstitutionsView = () => {
  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [coachId, setCoachId] = useState('')

  const [substitutions, setSubstitutions] = useState<SubstitutionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [actingOn, setActingOn] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SubstitutionItem | null>(null)

  const [exercises, setExercises] = useState<ExerciseOption[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<SubstitutionForm>(blankForm())
  const [saving, setSaving] = useState(false)

  const fetchCoaches = useCallback(async () => {
    try {
      const res = await api.get('/admin/coach-exceptions/coaches')
      setCoaches(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar la lista de coaches')
    }
  }, [])

  useEffect(() => { fetchCoaches() }, [fetchCoaches])
  useEffect(() => {
    if (!coachId && coaches.length > 0) setCoachId(String(coaches[0].id))
  }, [coachId, coaches])

  useEffect(() => {
    api.get('/admin/exercises?per_page=500').then(res => {
      const data = res.data?.data || res.data || []
      setExercises(data.map((e: any) => ({ id: e.id, label: e.title || e.name || `Ejercicio #${e.id}` })))
    }).catch(() => {})
  }, [])

  const fetchSubstitutions = useCallback(async () => {
    if (!coachId) { setSubstitutions([]); return }
    setLoading(true)
    try {
      const res = await api.get(`/admin/exercise-substitutions?coach_id=${coachId}`)
      setSubstitutions(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar las sustituciones de ejercicio')
    } finally {
      setLoading(false)
    }
  }, [coachId])

  useEffect(() => { fetchSubstitutions() }, [fetchSubstitutions])

  const exerciseLabel = useMemo(() => {
    const m = new Map(exercises.map(e => [e.id, e.label]))
    return (id: number) => m.get(id) || `Ejercicio #${id}`
  }, [exercises])

  const openCreate = () => {
    setEditingId(null)
    setForm(blankForm())
    setDialogOpen(true)
  }

  const openEdit = (item: SubstitutionItem) => {
    setEditingId(item.id)
    setForm({
      original_exercise_id: String(item.original_exercise_id),
      substitute_exercise_id: String(item.substitute_exercise_id),
      category: item.category ?? '__generic__',
      carga_ratio: item.carga_ratio != null ? String(item.carga_ratio) : '',
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.original_exercise_id || !form.substitute_exercise_id) {
      toast.error('Selecciona el ejercicio original y el sustituto')
      return
    }
    if (form.original_exercise_id === form.substitute_exercise_id) {
      toast.error('El ejercicio sustituto no puede ser el mismo que el original')
      return
    }

    const payload: any = {
      original_exercise_id: Number(form.original_exercise_id),
      substitute_exercise_id: Number(form.substitute_exercise_id),
      category: form.category === '__generic__' ? null : form.category,
      carga_ratio: numOrNull(form.carga_ratio),
    }

    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/admin/exercise-substitutions/${editingId}`, payload)
        toast.success('Sustitución actualizada')
      } else {
        await api.post('/admin/exercise-substitutions', { ...payload, coach_id: Number(coachId) })
        toast.success('Sustitución creada')
      }
      setDialogOpen(false)
      fetchSubstitutions()
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar la sustitución')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActingOn(deleteTarget.id)
    try {
      await api.delete(`/admin/exercise-substitutions/${deleteTarget.id}`)
      toast.success('Sustitución eliminada')
      setDeleteTarget(null)
      fetchSubstitutions()
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar la sustitución')
    } finally {
      setActingOn(null)
    }
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between flex-wrap gap-3'>
          <div>
            <CardTitle>Sustituciones de ejercicio</CardTitle>
            <CardDescription>
              Define qué ejercicio proponer en su lugar cuando el Motor de Auto-Regulación de Carga detecta
              estancamiento o fatiga en un ejercicio concreto.
            </CardDescription>
          </div>
          <div className='flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center'>
            <Select value={coachId} onValueChange={v => setCoachId(v ?? '')}>
              <SelectTrigger className='w-full sm:w-64'><SelectValue placeholder='Seleccionar coach' /></SelectTrigger>
              <SelectContent>
                {coaches.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className='flex gap-2'>
              <Button variant='outline' size='icon' onClick={fetchSubstitutions} disabled={loading} title='Actualizar'>
                <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              </Button>
              <Button className='flex-1 sm:flex-initial' onClick={openCreate} disabled={!coachId}>
                <Plus className='size-4 mr-1' /> Nueva sustitución
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex justify-center py-12'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
          ) : substitutions.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-muted-foreground text-sm'>
              <p>{coachId ? 'Este coach todavía no tiene ninguna sustitución configurada.' : 'Selecciona un coach para ver sus sustituciones.'}</p>
            </div>
          ) : (
            <div className='space-y-2.5'>
              {substitutions.map(item => {
                const busy = actingOn === item.id
                return (
                  <div key={item.id} className='rounded-lg border p-3.5'>
                    <div className='flex items-start justify-between gap-3 flex-wrap'>
                      <div className='min-w-0'>
                        <div className='flex items-center gap-2 flex-wrap text-sm font-medium'>
                          <span>{item.original_exercise?.title || exerciseLabel(item.original_exercise_id)}</span>
                          <ArrowLeftRight className='size-3.5 text-muted-foreground shrink-0' />
                          <span>{item.substitute_exercise?.title || exerciseLabel(item.substitute_exercise_id)}</span>
                        </div>
                        <div className='flex items-center gap-2 flex-wrap mt-1.5'>
                          <Badge variant='outline'>{item.category ? (CATEGORY_LABELS[item.category] || item.category) : 'Genérico (sin categoría)'}</Badge>
                          {item.carga_ratio != null && (
                            <span className='text-xs text-muted-foreground'>Ratio de carga de arranque: {item.carga_ratio}</span>
                          )}
                        </div>
                      </div>
                      <div className='flex items-center gap-1.5 shrink-0'>
                        <Button size='sm' variant='ghost' disabled={busy} onClick={() => openEdit(item)}>
                          <Pencil className='size-3.5 mr-1' /> Editar
                        </Button>
                        <Button size='sm' variant='ghost' disabled={busy} className='text-destructive hover:text-destructive' onClick={() => setDeleteTarget(item)}>
                          <Trash2 className='size-3.5 mr-1' /> Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Crear/editar ──────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false) }}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar sustitución' : 'Nueva sustitución de ejercicio'}</DialogTitle>
            <DialogDescription>
              Cuando el motor detecte el motivo elegido en el ejercicio original, propondrá el ejercicio sustituto.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Ejercicio original</FieldLabel>
              <Select value={form.original_exercise_id} onValueChange={v => setForm(f => ({ ...f, original_exercise_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar ejercicio' /></SelectTrigger>
                <SelectContent>
                  {exercises.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Ejercicio sustituto</FieldLabel>
              <Select value={form.substitute_exercise_id} onValueChange={v => setForm(f => ({ ...f, substitute_exercise_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar ejercicio' /></SelectTrigger>
                <SelectContent>
                  {exercises.filter(e => String(e.id) !== form.original_exercise_id).map(e => <SelectItem key={e.id} value={String(e.id)}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Categoría (motivo inferido)</FieldLabel>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v ?? '__generic__' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Ratio de carga de arranque</FieldLabel>
              <Input type='number' step='0.05' min='0' value={form.carga_ratio} onChange={e => setForm(f => ({ ...f, carga_ratio: e.target.value }))} placeholder='p. ej. 0.8' />
              <p className='text-[11px] text-muted-foreground'>
                Opcional — si se deja vacío, la sustitución no propone carga de arranque.
              </p>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear sustitución'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar ───────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar sustitución</DialogTitle></DialogHeader>
          <p className='text-sm'>
            ¿Seguro que quieres eliminar la sustitución «{deleteTarget?.original_exercise?.title}» → «{deleteTarget?.substitute_exercise?.title}»?
            Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteTarget(null)} disabled={actingOn === deleteTarget?.id}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete} disabled={actingOn === deleteTarget?.id}>
              {actingOn === deleteTarget?.id ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ExerciseSubstitutionsView
