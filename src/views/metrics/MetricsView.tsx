import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type Metric = {
  id: number
  key: string
  label: string
  unit: string | null
  input_type: string | null
  higher_is_better: boolean
  order: number
}

const INPUT_TYPES = [
  { label: 'Número', value: 'number' },
  { label: 'Texto', value: 'text' },
  { label: 'Duración', value: 'duration' },
  { label: 'Distancia', value: 'distance' },
]

const MetricsView = () => {
  const [items, setItems] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Metric | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    key: '',
    label: '',
    unit: '',
    input_type: 'number',
    higher_is_better: false,
    order: 0,
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/metric-list')
      setItems(res.data || [])
    } catch {
      toast.error('Error al obtener las métricas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setEditingItem(null)
    setFormData({ key: '', label: '', unit: '', input_type: 'number', higher_is_better: false, order: items.length + 1 })
    setDialogOpen(true)
  }

  const openEdit = (item: Metric) => {
    setEditingItem(item)
    setFormData({
      key: item.key,
      label: item.label,
      unit: item.unit || '',
      input_type: item.input_type || 'number',
      higher_is_better: item.higher_is_better,
      order: item.order,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.key.trim() || !formData.label.trim()) {
      toast.error('La clave y la etiqueta son obligatorias')
      return
    }
    setSubmitting(true)
    try {
      const payload: any = {
        label: formData.label.trim(),
        unit: formData.unit.trim() || null,
        input_type: formData.input_type,
        higher_is_better: formData.higher_is_better,
        order: Number(formData.order),
      }

      if (editingItem) {
        payload.id = editingItem.id
        await api.post('/admin/metric-update', payload)
        toast.success('Métrica actualizada')
      } else {
        payload.key = formData.key.trim()
        await api.post('/admin/metric-store', payload)
        toast.success('Métrica creada')
      }
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar la métrica')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>Catálogo de métricas</h1>
        <Button onClick={openCreate}>
          <PlusIcon className='size-4 mr-1' /> Nueva Métrica
        </Button>
      </div>

      <Card>
        <CardContent className='p-0'>
          {loading ? (
            <div className='flex items-center justify-center py-20'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Clave</TableHead>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Tipo de entrada</TableHead>
                  <TableHead>Mayor es mejor</TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.order}</TableCell>
                    <TableCell className='font-medium'>{item.key}</TableCell>
                    <TableCell>{item.label}</TableCell>
                    <TableCell>{item.unit || '—'}</TableCell>
                    <TableCell><Badge variant='outline'>{item.input_type || 'number'}</Badge></TableCell>
                    <TableCell>{item.higher_is_better ? 'Sí' : 'No'}</TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-1'>
                        <Button variant='ghost' size='sm' onClick={() => openEdit(item)}>
                          <PencilIcon className='size-3.5' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className='flex flex-col items-center py-12 text-muted-foreground'>
              <p>No hay métricas configuradas</p>
              <p className='text-sm'>Crea la primera métrica para hacer seguimiento del progreso del cliente.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Métrica' : 'Nueva Métrica'}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Clave *</FieldLabel>
                <Input
                  placeholder='p. ej. body_weight'
                  value={formData.key}
                  onChange={e => setFormData(prev => ({ ...prev, key: e.target.value }))}
                  disabled={!!editingItem}
                />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Etiqueta *</FieldLabel>
                <Input
                  placeholder='p. ej. Peso corporal'
                  value={formData.label}
                  onChange={e => setFormData(prev => ({ ...prev, label: e.target.value }))}
                />
              </Field>
            </div>
            <div className='grid grid-cols-3 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Unidad</FieldLabel>
                <Input
                  placeholder='p. ej. kg'
                  value={formData.unit}
                  onChange={e => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Tipo de entrada</FieldLabel>
                <Select value={formData.input_type} onValueChange={v => setFormData(prev => ({ ...prev, input_type: v ?? 'number' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INPUT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Orden</FieldLabel>
                <Input
                  type='number'
                  value={formData.order}
                  onChange={e => setFormData(prev => ({ ...prev, order: Number(e.target.value) }))}
                />
              </Field>
            </div>
            <div className='flex items-center gap-3'>
              <Switch
                checked={formData.higher_is_better}
                onCheckedChange={v => setFormData(prev => ({ ...prev, higher_is_better: v }))}
              />
              <span className='text-sm'>Un valor más alto es mejor</span>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : editingItem ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MetricsView
