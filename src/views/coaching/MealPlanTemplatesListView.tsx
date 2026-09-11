import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Trash2, ListChecks, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type TemplateType = 'sequential' | 'weekday'

type Template = {
  id: number
  title: string
  type: TemplateType
  items_count: number
  coach?: { id: number; name: string }
  created_at: string
}

export default function MealPlanTemplatesListView() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState<TemplateType>('sequential')
  const [creating, setCreating] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/meal-plan-templates?per_page=100')
      setTemplates(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar las plantillas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/admin/meal-plan-templates', { title: newTitle.trim(), type: newType })
      toast.success('Plantilla creada')
      setCreateDialogOpen(false)
      setNewTitle('')
      navigate(`/meal-plan-templates/${res.data.id}`)
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al crear la plantilla')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/admin/meal-plan-templates/${deleteTarget.id}`)
      toast.success('Plantilla eliminada')
      setDeleteTarget(null)
      fetchTemplates()
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || 'Error al eliminar la plantilla')
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Plantillas de planes de comidas</CardTitle>
          <Button size='sm' onClick={() => { setNewTitle(''); setNewType('sequential'); setCreateDialogOpen(true) }}>
            <Plus className='size-4 mr-1' /> Nueva plantilla
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex justify-center py-12'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : templates.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-20 text-muted-foreground'>
              <ListChecks className='size-12 mb-4 opacity-50' />
              <p>Aún no hay plantillas de planes de comidas</p>
              <p className='text-xs mt-1'>Crea una aquí, o exporta el calendario existente de un cliente como plantilla desde Calendario de comidas del cliente.</p>
            </div>
          ) : (
            <div className='divide-y'>
              {templates.map(t => (
                <button
                  key={t.id}
                  className='w-full flex items-center justify-between py-3 px-1 text-left hover:bg-muted/40 rounded-md transition-colors group'
                  onClick={() => navigate(`/meal-plan-templates/${t.id}`)}
                >
                  <div className='flex items-center gap-3'>
                    <div className='size-9 rounded-md bg-muted flex items-center justify-center'>
                      <ListChecks className='size-4 text-muted-foreground' />
                    </div>
                    <div>
                      <p className='text-sm font-medium'>{t.title}</p>
                      <p className='text-xs text-muted-foreground'>
                        {t.items_count} {t.items_count === 1 ? 'comida' : 'comidas'} · {t.coach?.name ?? 'Desconocido'}
                      </p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Badge variant={t.type === 'sequential' ? 'default' : 'secondary'}>
                      {t.type === 'sequential' ? 'Día 1, 2...' : 'Semanal (lun-dom)'}
                    </Badge>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='opacity-0 group-hover:opacity-100'
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(t) }}
                    >
                      <Trash2 className='size-4 text-destructive' />
                    </Button>
                    <ChevronRight className='size-4 text-muted-foreground' />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva plantilla de plan de comidas</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título</FieldLabel>
              <Input placeholder='p. ej. Plan de definición de 30 días' value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Tipo</FieldLabel>
              <Select value={newType} onValueChange={v => setNewType((v as TemplateType) ?? 'sequential')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='sequential'>Secuencial — Día 1, Día 2... (cualquier duración, sin fechas fijas)</SelectItem>
                  <SelectItem value='weekday'>Semanal — de lunes a domingo, se repite cada semana</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || creating}>
              {creating ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar "{deleteTarget?.title}"?</DialogTitle>
          </DialogHeader>
          <p className='text-sm text-muted-foreground'>Esto elimina la plantilla y todas sus comidas guardadas. Los clientes que ya la importaron conservan sus comidas asignadas — esto solo elimina la plantilla reutilizable.</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
