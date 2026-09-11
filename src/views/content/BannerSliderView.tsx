import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, UploadIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type BannerSlider = {
  id: number
  title: string
  slug: string
  type: 'url' | 'workout' | string
  url: string | null
  workout_id: number | null
  status: 'active' | 'inactive' | string
  bannerslider_image: string | null
  created_at: string
}

type Workout = { id: number; title: string }

const BannerSliderView = () => {
  const [items, setItems] = useState<BannerSlider[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<BannerSlider | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<BannerSlider | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [workouts, setWorkouts] = useState<Workout[]>([])

  const [formData, setFormData] = useState({
    title: '',
    type: 'url' as string,
    url: '',
    workout_id: '',
    status: 'active' as string,
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/banner-sliders?per_page=100')
      setItems(res.data || [])
    } catch {
      toast.error('No se pudieron cargar los deslizantes de banner')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchWorkouts = useCallback(async () => {
    try {
      const res = await api.get('/admin/workouts?per_page=500')
      setWorkouts(res.data || [])
    } catch {
      // best-effort fetch, ignore failures
    }
  }, [])

  useEffect(() => { Promise.all([fetchItems(), fetchWorkouts()]) }, [fetchItems, fetchWorkouts])

  const openCreate = () => {
    setEditingItem(null)
    setFormData({ title: '', type: 'url', url: '', workout_id: '', status: 'active' })
    setImageFile(null)
    setImagePreview(null)
    setDialogOpen(true)
  }

  const openEdit = (item: BannerSlider) => {
    setEditingItem(item)
    setFormData({
      title: item.title,
      type: item.type || 'url',
      url: item.url || '',
      workout_id: item.workout_id ? String(item.workout_id) : '',
      status: item.status,
    })
    setImageFile(null)
    setImagePreview(item.bannerslider_image)
    setDialogOpen(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) { toast.error('El título es obligatorio'); return }
    if (formData.type === 'url' && !formData.url.trim()) { toast.error('La URL es obligatoria cuando el tipo es URL'); return }
    if (formData.type === 'workout' && !formData.workout_id) { toast.error('El entrenamiento es obligatorio cuando el tipo es Entrenamiento'); return }
    if (!editingItem && !imageFile) { toast.error('La imagen es obligatoria para los nuevos deslizantes de banner'); return }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('title', formData.title.trim())
      fd.append('type', formData.type)
      fd.append('status', formData.status)
      if (formData.type === 'url') {
        fd.append('url', formData.url.trim())
      } else {
        fd.append('url', '')
      }
      if (formData.type === 'workout' && formData.workout_id) {
        fd.append('workout_id', formData.workout_id)
      }
      if (imageFile) {
        fd.append('bannerslider_image', imageFile)
      }

      if (editingItem) {
        await api.put(`/admin/banner-sliders/${editingItem.id}`, fd)
        toast.success('Deslizante de banner actualizado')
      } else {
        await api.post('/admin/banner-sliders', fd)
        toast.success('Deslizante de banner creado')
      }
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar el deslizante de banner')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    try {
      await api.delete(`/admin/banner-sliders/${deletingItem.id}`)
      toast.success('Deslizante de banner eliminado')
      setDeleteDialogOpen(false)
      setDeletingItem(null)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo eliminar')
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>Deslizantes de banner</h1>
        <Button onClick={openCreate}>
          <PlusIcon className='size-4 mr-1' /> Nuevo banner
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
                  <TableHead>Imagen</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.bannerslider_image ? (
                        <img src={item.bannerslider_image} alt='' loading='lazy' decoding='async' className='h-12 w-24 object-cover rounded border' />
                      ) : (
                        <div className='h-12 w-24 bg-muted rounded border flex items-center justify-center text-muted-foreground text-xs'>Sin imagen</div>
                      )}
                    </TableCell>
                    <TableCell className='font-medium'>{item.title}</TableCell>
                    <TableCell>
                      <Badge variant='outline' className='capitalize'>{item.type}</Badge>
                      {item.type === 'url' && item.url && (
                        <p className='text-xs text-muted-foreground truncate max-w-[200px]'>{item.url}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>{item.status}</Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-1'>
                        <Button variant='ghost' size='sm' onClick={() => openEdit(item)}>
                          <PencilIcon className='size-3.5' />
                        </Button>
                        <Button variant='ghost' size='sm' onClick={() => { setDeletingItem(item); setDeleteDialogOpen(true) }}>
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
              <UploadIcon className='size-12 mb-4 opacity-50' />
              <p>No hay deslizantes de banner</p>
              <p className='text-sm'>Crea el primer banner para la app.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar deslizante de banner' : 'Nuevo deslizante de banner'}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título</FieldLabel>
              <Input value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} />
            </Field>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Tipo</FieldLabel>
                <Select value={formData.type} onValueChange={v => setFormData(prev => ({ ...prev, type: v ?? 'url' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='url'>URL</SelectItem>
                    <SelectItem value='workout'>Entrenamiento</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Estado</FieldLabel>
                <Select value={formData.status} onValueChange={v => setFormData(prev => ({ ...prev, status: v ?? 'active' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='active'>Activo</SelectItem>
                    <SelectItem value='inactive'>Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {formData.type === 'url' && (
              <Field className='gap-2'>
                <FieldLabel>URL</FieldLabel>
                <Input value={formData.url} onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))} />
              </Field>
            )}
            {formData.type === 'workout' && (
              <Field className='gap-2'>
                <FieldLabel>Entrenamiento</FieldLabel>
                <Select value={formData.workout_id} onValueChange={v => setFormData(prev => ({ ...prev, workout_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar entrenamiento' /></SelectTrigger>
                  <SelectContent>
                    {workouts.map(w => (
                      <SelectItem key={w.id} value={String(w.id)}>{w.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field className='gap-2'>
              <FieldLabel>Imagen del banner</FieldLabel>
              <div className='space-y-2'>
                <label className='inline-flex items-center'>
                  <input type='file' accept='image/*' className='hidden' onChange={handleImageChange} />
                  <span className='inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer'>
                    <UploadIcon className='size-3.5' /> {imageFile ? 'Cambiar imagen' : 'Subir imagen'}
                  </span>
                </label>
                {imagePreview && (
                  <div className='relative inline-block'>
                    <img src={imagePreview} alt='Vista previa' className='h-32 rounded border object-cover' />
                    <button
                      className='absolute top-1 right-1 rounded-full bg-black/50 text-white p-0.5 hover:bg-black/70'
                      onClick={() => { setImageFile(null); setImagePreview(null) }}
                    >
                      <XIcon className='size-3' />
                    </button>
                  </div>
                )}
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar deslizante de banner</DialogTitle></DialogHeader>
          <p className='text-sm text-muted-foreground'>¿Estás seguro de que quieres eliminar <strong>{deletingItem?.title}</strong>?</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default BannerSliderView
