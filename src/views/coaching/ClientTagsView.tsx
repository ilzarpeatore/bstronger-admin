import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, TrashIcon, TagIcon, PencilIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type ClientTag = {
  id: number
  title: string
  color: string
}

type User = {
  id: number
  name?: string
  first_name?: string
  last_name?: string
  email: string
}

const TAG_COLORS = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#ef4444', label: 'Rojo' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#f59e0b', label: 'Ámbar' },
  { value: '#8b5cf6', label: 'Púrpura' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Cian' },
  { value: '#64748b', label: 'Pizarra' },
]

export default function ClientTagsView() {
  const [tags, setTags] = useState<ClientTag[]>([])
  const [loading, setLoading] = useState(true)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTag, setDeletingTag] = useState<ClientTag | null>(null)
  const [tagTitle, setTagTitle] = useState('')
  const [tagColor, setTagColor] = useState('#3b82f6')
  const [submitting, setSubmitting] = useState(false)
  const [editingTag, setEditingTag] = useState<ClientTag | null>(null)

  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assigningTag, setAssigningTag] = useState(false)
  const [assignTagId, setAssignTagId] = useState('')
  const [assignClientId, setAssignClientId] = useState('')
  const [clients, setClients] = useState<User[]>([])

  const [selectedClientId, setSelectedClientId] = useState('')
  const [clientTags, setClientTags] = useState<ClientTag[]>([])

  const fetchTags = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/client-tag-list')
      setTags(res.data || [])
    } catch {
      toast.error('Error al cargar las etiquetas')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchClients = async (search = '') => {
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (search) params.set('search', search)
      const res = await api.get(`/admin/users?${params}`)
      setClients(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar los clientes')
    }
  }

  const fetchClientTags = async (clientId: string) => {
    if (!clientId) { setClientTags([]); return }
    try {
      const res = await api.get(`/admin/client-tags-of-client?client_id=${clientId}`)
      setClientTags(res.data || [])
    } catch {
      toast.error('Error al cargar las etiquetas del cliente')
    }
  }

  useEffect(() => { fetchTags() }, [fetchTags])

  const handleCreateTag = async () => {
    if (!tagTitle.trim()) { toast.error('El título es obligatorio'); return }
    setSubmitting(true)
    try {
      await api.post('/admin/client-tag-store', { title: tagTitle, color: tagColor })
      toast.success('Etiqueta creada')
      setTagDialogOpen(false)
      fetchTags()
    } catch (err: any) {
      toast.error(err?.message || 'Error al crear la etiqueta')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateTag = async () => {
    if (!editingTag) return
    if (!tagTitle.trim()) { toast.error('El título es obligatorio'); return }
    setSubmitting(true)
    try {
      await api.post('/admin/client-tag-store', { id: editingTag.id, title: tagTitle, color: tagColor })
      toast.success('Etiqueta actualizada')
      setTagDialogOpen(false)
      setEditingTag(null)
      fetchTags()
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar la etiqueta')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTag = async () => {
    if (!deletingTag) return
    try {
      await api.post('/admin/client-tag-delete', { id: deletingTag.id })
      toast.success('Etiqueta eliminada')
      setDeleteDialogOpen(false)
      fetchTags()
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar')
    }
  }

  const handleAssignTag = async () => {
    if (!assignClientId || !assignTagId) { toast.error('Selecciona un cliente y una etiqueta'); return }
    // FIX (auditoría 2026-09-13): sin estado de envío -- doble clic podía
    // mandar dos POST /client-tag-assign seguidos.
    setAssigningTag(true)
    try {
      await api.post('/admin/client-tag-assign', {
        client_id: Number(assignClientId),
        client_tag_id: Number(assignTagId)
      })
      toast.success('Etiqueta asignada')
      setAssignDialogOpen(false)
      if (selectedClientId === assignClientId) fetchClientTags(assignClientId)
    } catch (err: any) {
      toast.error(err?.message || 'Error al asignar')
    } finally {
      setAssigningTag(false)
    }
  }

  const handleRemoveTag = async (tagId: number) => {
    if (!selectedClientId) return
    // FIX (auditoría 2026-09-13): desasignar sin confirmación, inconsistente
    // con borrar la etiqueta global (handleDeleteTag), que sí la tiene.
    if (!confirm('¿Desasignar esta etiqueta del cliente?')) return
    try {
      await api.post('/admin/client-tag-remove', {
        client_id: Number(selectedClientId),
        client_tag_id: tagId
      })
      toast.success('Etiqueta desasignada')
      fetchClientTags(selectedClientId)
    } catch (err: any) {
      toast.error(err?.message || 'Error al desasignar')
    }
  }

  const openCreateDialog = () => {
    setEditingTag(null)
    setTagTitle('')
    setTagColor('#3b82f6')
    setTagDialogOpen(true)
  }

  const openEditDialog = (tag: ClientTag) => {
    setEditingTag(tag)
    setTagTitle(tag.title)
    setTagColor(tag.color)
    setTagDialogOpen(true)
  }

  return (
    <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
      <Card className='lg:col-span-2'>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Etiquetas de clientes</CardTitle>
          <div className='flex gap-2'>
            <Button onClick={openCreateDialog}>
              <PlusIcon className='size-4 mr-2' /> Nueva etiqueta
            </Button>
            <Button variant='outline' onClick={() => { fetchClients(); setAssignClientId(''); setAssignTagId(''); setAssignDialogOpen(true) }}>
              <TagIcon className='size-4 mr-2' /> Asignar etiqueta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex justify-center py-12'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : tags.length ? (
            <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
              {tags.map(tag => (
                <div key={tag.id} className='flex items-center justify-between rounded-md border p-3'>
                  <div className='flex items-center gap-2'>
                    <div className='h-4 w-4 rounded-full' style={{ backgroundColor: tag.color }} />
                    <span className='font-medium text-sm'>{tag.title}</span>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Button variant='ghost' size='sm' onClick={() => openEditDialog(tag)}>
                      <PencilIcon className='size-3' />
                    </Button>
                    <Button variant='ghost' size='sm' onClick={() => { setDeletingTag(tag); setDeleteDialogOpen(true) }}>
                      <TrashIcon className='size-3 text-destructive' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-center text-muted-foreground py-12'>Aún no hay etiquetas. Crea una para empezar.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Etiquetas de clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedClientId} onValueChange={v => { const val = v ?? ''; setSelectedClientId(val); fetchClientTags(val) }}>
            <SelectTrigger className='mb-4'><SelectValue placeholder='Seleccionar cliente' /></SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name || `${c.first_name} ${c.last_name}`} ({c.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedClientId && (
            <div className='space-y-2'>
              {clientTags.length > 0 ? clientTags.map(tag => (
                <div key={tag.id} className='flex items-center justify-between rounded-md border p-2'>
                  <div className='flex items-center gap-2'>
                    <div className='h-3 w-3 rounded-full' style={{ backgroundColor: tag.color }} />
                    <span className='text-sm'>{tag.title}</span>
                  </div>
                  <Button variant='ghost' size='sm' onClick={() => handleRemoveTag(tag.id)}>
                    <TrashIcon className='size-3 text-destructive' />
                  </Button>
                </div>
              )) : (
                <p className='text-sm text-muted-foreground text-center py-4'>No hay etiquetas asignadas</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={tagDialogOpen} onOpenChange={open => { setTagDialogOpen(open); if (!open) setEditingTag(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTag ? 'Editar etiqueta' : 'Crear etiqueta'}</DialogTitle></DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título</FieldLabel>
              <Input value={tagTitle} onChange={e => setTagTitle(e.target.value)} placeholder='Nombre de la etiqueta' />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Color</FieldLabel>
              <div className='flex gap-2 flex-wrap'>
                {TAG_COLORS.map(c => (
                  <button
                    key={c.value}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${tagColor === c.value ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setTagColor(c.value)}
                    title={c.label}
                  />
                ))}
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => { setTagDialogOpen(false); setEditingTag(null) }}>Cancelar</Button>
            <Button onClick={editingTag ? handleUpdateTag : handleCreateTag} disabled={submitting}>
              {submitting ? (editingTag ? 'Guardando...' : 'Creando...') : (editingTag ? 'Guardar' : 'Crear')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar etiqueta</DialogTitle></DialogHeader>
          <p>¿Seguro que quieres eliminar &quot;{deletingTag?.title}&quot;? Se eliminará de todos los clientes.</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDeleteTag}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar etiqueta al cliente</DialogTitle></DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Cliente</FieldLabel>
              <Select value={assignClientId} onValueChange={v => setAssignClientId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Seleccionar cliente' /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name || `${c.first_name} ${c.last_name}`} ({c.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Etiqueta</FieldLabel>
              <Select value={assignTagId} onValueChange={v => setAssignTagId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Seleccionar etiqueta' /></SelectTrigger>
                <SelectContent>
                  {tags.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <div className='flex items-center gap-2'>
                        <div className='h-3 w-3 rounded-full' style={{ backgroundColor: t.color }} />
                        {t.title}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssignTag} disabled={assigningTag}>{assigningTag ? 'Asignando...' : 'Asignar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
