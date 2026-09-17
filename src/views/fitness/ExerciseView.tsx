
import { useState, useEffect, useCallback, useMemo } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api, apiFetch } from '@/lib/api'

type ExerciseItem = {
  id: number
  title: string
  slug: string
  exercise_image: string | null
  level_id: number | null
  level_title: string | null
  equipment_id: number | null
  equipment_title: string | null
  bodypart_ids: number[] | null
  bodypart_names: string | null
  type: string | null
  exercise_type: string | null
  exercise_type_label: string | null
  based: string | null
  duration: string | null
  seconds_per_rep: number | null
  is_premium: boolean | number
  status: string
  instruction: string | null
  tips: string | null
  video_type: string | null
  video_url: string | null
  created_at: string
  updated_at: string
}

type Level = { id: number; title: string }
type Equipment = { id: number; title: string }
type BodyPart = { id: number; title: string }

// Categoría de entrenamiento (filtro nuevo) — distinta del campo "Tipo" ya
// existente en este formulario, que en realidad guarda 'sets'/'duration'
// (cómo se registran las series), no una categoría de ejercicio.
const EXERCISE_TYPES: { value: string; label: string }[] = [
  { value: 'fuerza', label: 'Fuerza' },
  { value: 'movilidad', label: 'Movilidad' },
  { value: 'pliometria', label: 'Pliometría' },
  { value: 'metabolico', label: 'Metabólico' },
  { value: 'cardio', label: 'Cardio' },
]

export default function ExerciseView() {
  const [items, setItems] = useState<ExerciseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ExerciseItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<ExerciseItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [levels, setLevels] = useState<Level[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([])

  const [formData, setFormData] = useState<Record<string, any>>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedBodyParts, setSelectedBodyParts] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return items.slice(start, start + PAGE_SIZE)
  }, [items, page])

  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '-1' })
      if (search) params.set('search', search)
      const res = await api.get(`/admin/exercises?${params}`)
      setItems(res.data?.data || res.data || [])
      setPage(1)
    } catch {
      toast.error('Error al cargar los ejercicios')
    } finally {
      setLoading(false)
    }
  }, [search])

  const fetchMeta = useCallback(async () => {
    try {
      const [levelsRes, equipRes, bpRes] = await Promise.all([
        api.get('/admin/levels?per_page=-1'),
        api.get('/admin/equipment?per_page=-1'),
        api.get('/admin/body-parts?per_page=-1'),
      ])
      setLevels(levelsRes.data?.data || levelsRes.data || [])
      setEquipments(equipRes.data?.data || equipRes.data || [])
      setBodyParts(bpRes.data?.data || bpRes.data || [])
    } catch {
      // best-effort fetch, ignore failures
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])
  useEffect(() => { fetchMeta() }, [fetchMeta])

  const openCreate = () => {
    setEditingItem(null)
    setFormData({ title: '', instruction: '', tips: '', video_type: '', video_url: '', duration: '', seconds_per_rep: '', status: 'active', is_premium: '0', exercise_type: '' })
    setSelectedBodyParts([])
    setImageFile(null)
    setImagePreview(null)
    setDialogOpen(true)
  }

  const openEdit = (item: ExerciseItem) => {
    setEditingItem(item)
    setFormData({
      title: item.title || '',
      instruction: item.instruction || '',
      tips: item.tips || '',
      video_type: item.video_type || '',
      video_url: item.video_url || '',
      duration: item.duration || '',
      seconds_per_rep: item.seconds_per_rep || '',
      status: item.status || 'active',
      is_premium: String(item.is_premium ?? '0'),
      type: item.type || '',
      exercise_type: item.exercise_type || '',
      level_id: item.level_id ? String(item.level_id) : '',
      equipment_id: item.equipment_id ? String(item.equipment_id) : '',
    })
    setSelectedBodyParts(item.bodypart_ids || [])
    setImageFile(null)
    setImagePreview(item.exercise_image || null)
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.title?.trim()) { toast.error('El título es obligatorio'); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      Object.entries(formData).forEach(([k, v]) => { if (v != null && v !== '') fd.append(k, String(v)) })
      fd.append('bodypart_ids', JSON.stringify(selectedBodyParts))
      if (imageFile) fd.append('image', imageFile)

      if (editingItem) {
        // BUG (auditoría 2026-09-13): apiFetch con method:'PUT' + FormData
        // manda un PUT real con cuerpo multipart -- Laravel/PHP no lo
        // parsea en verbos != POST, así que 'title' (required) llegaba
        // vacío y la validación fallaba SIEMPRE, en toda edición de
        // ejercicio (no solo al cambiar imagen). api.upload() spoofea PUT
        // vía POST + _method.
        await api.upload(`/admin/exercises/${editingItem.id}`, fd, 'PUT')
        toast.success('Ejercicio actualizado')
      } else {
        await apiFetch('/admin/exercises', { method: 'POST', body: fd })
        toast.success('Ejercicio creado')
      }
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    try {
      await api.delete(`/admin/exercises/${deletingItem.id}`)
      toast.success('Eliminado')
      setDeleteDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar')
    }
  }

  const toggleBodyPart = (id: number) => {
    setSelectedBodyParts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <CardTitle>Ejercicios</CardTitle>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <div className='relative w-full sm:w-72'>
              <SearchIcon className='absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
              <Input placeholder='Buscar ejercicios...' value={search} onChange={e => setSearch(e.target.value)} className='w-full pl-9' />
            </div>
            <Button onClick={openCreate}>
              <PlusIcon className='size-4 mr-2' /> Añadir Ejercicio
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex justify-center py-16'>
              <div className='h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : items.length === 0 ? (
            <p className='text-center text-muted-foreground py-16'>No se encontraron ejercicios.</p>
          ) : (
            <>
            <div className='grid gap-3'>
              {paginatedItems.map(item => (
                <div
                  key={item.id}
                  className='flex items-center gap-4 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50'
                >
                  <div className='size-16 shrink-0 overflow-hidden rounded-md bg-muted'>
                    {item.exercise_image ? (
                      <img src={item.exercise_image} alt={item.title} loading='lazy' decoding='async' className='size-full object-cover' />
                    ) : (
                      <div className='flex size-full items-center justify-center text-xs text-muted-foreground'>Sin imagen</div>
                    )}
                  </div>

                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium leading-tight truncate'>{item.title}</p>
                    <div className='mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                      {item.bodypart_names && (
                        <span>{item.bodypart_names}</span>
                      )}
                      {item.exercise_type_label && (
                        <span>{item.exercise_type_label}</span>
                      )}
                      {item.level_title && (
                        <span>{item.level_title}</span>
                      )}
                    </div>
                  </div>

                  <div className='flex shrink-0 items-center gap-1'>
                    <Button variant='ghost' size='sm' onClick={() => openEdit(item)}>
                      <PencilIcon className='size-4' />
                    </Button>
                    <Button variant='ghost' size='sm' onClick={() => { setDeletingItem(item); setDeleteDialogOpen(true) }}>
                      <TrashIcon className='size-4 text-destructive' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className='flex items-center justify-between pt-4'>
                <p className='text-xs text-muted-foreground'>Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, items.length)} de {items.length}</p>
                <div className='flex gap-1'>
                  <Button variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <Button variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                </div>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Ejercicio' : 'Crear Ejercicio'}</DialogTitle>
          </DialogHeader>

          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Imagen</FieldLabel>
              <div className='flex items-center gap-3'>
                {imagePreview && (
                  <div className='size-16 overflow-hidden rounded-md bg-muted'>
                    <img src={imagePreview} alt='Vista previa' className='size-full object-cover' />
                  </div>
                )}
                <Input
                  type='file'
                  accept='image/*'
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setImageFile(file)
                      setImagePreview(URL.createObjectURL(file))
                    }
                  }}
                />
              </div>
            </Field>

            <Field className='gap-2'>
              <FieldLabel>Título *</FieldLabel>
              <Input value={formData.title || ''} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder='Título del ejercicio' />
            </Field>

            <Field className='gap-2'>
              <FieldLabel>Enfoque principal (Partes del cuerpo)</FieldLabel>
              <div className='flex flex-wrap gap-1.5'>
                {bodyParts.map(bp => (
                  <Badge
                    key={bp.id}
                    variant={selectedBodyParts.includes(bp.id) ? 'default' : 'outline'}
                    className='cursor-pointer text-xs'
                    onClick={() => toggleBodyPart(bp.id)}
                  >
                    {bp.title}
                  </Badge>
                ))}
              </div>
            </Field>

            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Tipo</FieldLabel>
                <Select value={formData.type || ''} onValueChange={v => setFormData(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar tipo' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='strength'>Fuerza</SelectItem>
                    <SelectItem value='cardio'>Cardio</SelectItem>
                    <SelectItem value='flexibility'>Flexibilidad</SelectItem>
                    <SelectItem value='balance'>Equilibrio</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field className='gap-2'>
                <FieldLabel>Nivel</FieldLabel>
                <Select value={formData.level_id || ''} onValueChange={v => setFormData(p => ({ ...p, level_id: v }))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar nivel' /></SelectTrigger>
                  <SelectContent>
                    {levels.map(l => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field className='gap-2'>
              <FieldLabel>Categoría de entrenamiento</FieldLabel>
              <Select value={formData.exercise_type || ''} onValueChange={v => setFormData(p => ({ ...p, exercise_type: v }))}>
                <SelectTrigger><SelectValue placeholder='Seleccionar categoría' /></SelectTrigger>
                <SelectContent>
                  {EXERCISE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Equipo</FieldLabel>
                <Select value={formData.equipment_id || ''} onValueChange={v => setFormData(p => ({ ...p, equipment_id: v }))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar equipo' /></SelectTrigger>
                  <SelectContent>
                    {equipments.map(eq => (
                      <SelectItem key={eq.id} value={String(eq.id)}>{eq.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field className='gap-2'>
                <FieldLabel>Duración</FieldLabel>
                <Input value={formData.duration || ''} onChange={e => setFormData(p => ({ ...p, duration: e.target.value }))} placeholder='p. ej. 30s' />
              </Field>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Segundos por repetición</FieldLabel>
                <Input type='number' value={formData.seconds_per_rep || ''} onChange={e => setFormData(p => ({ ...p, seconds_per_rep: e.target.value }))} placeholder='4' />
              </Field>

              <Field className='gap-2'>
                <FieldLabel>Premium</FieldLabel>
                <Select value={formData.is_premium || '0'} onValueChange={v => setFormData(p => ({ ...p, is_premium: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='0'>No</SelectItem>
                    <SelectItem value='1'>Sí</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Tipo de vídeo</FieldLabel>
                <Select value={formData.video_type || ''} onValueChange={v => setFormData(p => ({ ...p, video_type: v }))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='youtube'>YouTube</SelectItem>
                    <SelectItem value='vimeo'>Vimeo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field className='gap-2'>
                <FieldLabel>URL del vídeo</FieldLabel>
                <Input value={formData.video_url || ''} onChange={e => setFormData(p => ({ ...p, video_url: e.target.value }))} placeholder='https://...' />
              </Field>
            </div>

            <Field className='gap-2'>
              <FieldLabel>Estado</FieldLabel>
              <Select value={formData.status || 'active'} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='active'>Activo</SelectItem>
                  <SelectItem value='inactive'>Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field className='gap-2'>
              <FieldLabel>Instrucción</FieldLabel>
              <textarea
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[60px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2'
                value={formData.instruction || ''}
                onChange={e => setFormData(p => ({ ...p, instruction: e.target.value }))}
                placeholder='Cómo realizar este ejercicio...'
              />
            </Field>

            <Field className='gap-2'>
              <FieldLabel>Consejos</FieldLabel>
              <textarea
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[60px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2'
                value={formData.tips || ''}
                onChange={e => setFormData(p => ({ ...p, tips: e.target.value }))}
                placeholder='Consejos para este ejercicio...'
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : editingItem ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar Ejercicio</DialogTitle></DialogHeader>
          <p>¿Estás seguro de que quieres eliminar este ejercicio? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
