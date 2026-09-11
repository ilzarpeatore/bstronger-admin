import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import { PlusIcon, TrashIcon, PencilIcon, SearchIcon, ImageIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type ClientRef = { id: number; first_name?: string; last_name?: string; email?: string }

type ResourceCategory = 'entrenamiento' | 'nutricion' | 'habitos_mindset' | 'onboarding' | 'planes_actuales'

type ResourceItem = {
  id: number
  title: string
  type: 'article' | 'video' | 'link' | 'doc'
  scope: 'shared' | 'assigned'
  category: ResourceCategory | null
  content: string | null
  external_url: string | null
  image_url: string | null
  created_at: string
  assigned_clients?: ClientRef[]
}

type SelectOption = { id: number; label: string }

const RESOURCE_TYPES = [
  { value: 'article', label: 'Artículo' },
  { value: 'video', label: 'Vídeo' },
  { value: 'link', label: 'Enlace' },
  { value: 'doc', label: 'Documento' },
]

const SCOPE_OPTIONS = [
  { value: 'shared', label: 'Compartido (todos los clientes)' },
  { value: 'assigned', label: 'Asignado (clientes concretos)' },
]

// Secciones dentro de cada pestaña de la app - dependen del ámbito elegido.
const CATEGORY_OPTIONS: Record<'shared' | 'assigned', { value: ResourceCategory; label: string }[]> = {
  shared: [
    { value: 'entrenamiento', label: 'Entrenamiento' },
    { value: 'nutricion', label: 'Nutrición' },
    { value: 'habitos_mindset', label: 'Hábitos y Mindset' },
  ],
  assigned: [
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'planes_actuales', label: 'Tus planes actuales' },
  ],
}

const ALL_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  entrenamiento: 'Entrenamiento',
  nutricion: 'Nutrición',
  habitos_mindset: 'Hábitos y Mindset',
  onboarding: 'Onboarding',
  planes_actuales: 'Tus planes actuales',
}

function clientLabel(c: ClientRef): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
  return name || c.email || `Cliente #${c.id}`
}

export default function ResourcesView() {
  const [items, setItems] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [scopeFilter, setScopeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<ResourceItem | null>(null)
  const [editingItem, setEditingItem] = useState<ResourceItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [title, setTitle] = useState('')
  const [type, setType] = useState('article')
  const [scope, setScope] = useState('shared')
  const [category, setCategory] = useState<string>('')
  const [externalUrl, setExternalUrl] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [allClients, setAllClients] = useState<SelectOption[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (scopeFilter !== 'all') params.set('scope', scopeFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (search.trim()) params.set('search', search.trim())
      const res = await api.get(`/admin/admin-resource-list?${params}`)
      setItems(res.data?.data?.data || res.data?.data || [])
    } catch {
      toast.error('Error al cargar los recursos')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, scopeFilter, categoryFilter, search])

  useEffect(() => { fetchItems() }, [fetchItems])

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/admin/users?per_page=500')
      const data = res.data?.data || res.data || []
      setAllClients(data.map((u: any) => ({ id: u.id, label: `${u.first_name || ''} ${u.last_name || ''} (${u.email})`.trim() })))
    } catch {
      toast.error('Error al cargar clientes')
    }
  }, [])

  const openCreate = () => {
    setEditingItem(null)
    setTitle(''); setType('article'); setScope('shared'); setCategory(''); setExternalUrl(''); setContent('')
    setImageUrl(''); setImageFile(null); setImagePreview(null)
    setSelectedClientIds([])
    setClientSearch('')
    fetchClients()
    setDialogOpen(true)
  }

  const openEdit = (item: ResourceItem) => {
    setEditingItem(item)
    setTitle(item.title); setType(item.type); setScope(item.scope); setCategory(item.category || '')
    setExternalUrl(item.external_url || ''); setContent(item.content || '')
    setImageUrl(item.image_url || ''); setImageFile(null); setImagePreview(item.image_url || null)
    setSelectedClientIds((item.assigned_clients || []).map(c => c.id))
    setClientSearch('')
    fetchClients()
    setDialogOpen(true)
  }

  const handlePickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  // Al cambiar el ámbito, la sección elegida deja de ser válida si
  // pertenecía al otro conjunto (p.ej. de "Nutrición" a "Onboarding").
  const handleScopeChange = (value: string) => {
    setScope(value)
    const validValues = CATEGORY_OPTIONS[value as 'shared' | 'assigned'].map(c => c.value)
    if (!validValues.includes(category as ResourceCategory)) {
      setCategory('')
    }
  }

  const toggleClient = (id: number) => {
    setSelectedClientIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleSave = async () => {
    if (!title.trim()) { toast.error('El título es obligatorio'); return }
    setSubmitting(true)
    try {
      if (imageFile) {
        const fd = new FormData()
        if (editingItem) fd.append('id', String(editingItem.id))
        fd.append('title', title.trim())
        fd.append('type', type)
        fd.append('scope', scope)
        if (category) fd.append('category', category)
        if (externalUrl.trim()) fd.append('external_url', externalUrl.trim())
        if (content) fd.append('content', content)
        fd.append('image', imageFile)
        if (scope === 'assigned') selectedClientIds.forEach(id => fd.append('client_ids[]', String(id)))
        await api.upload(editingItem ? '/admin/admin-resource-update' : '/admin/admin-resource-store', fd)
      } else {
        const payload = {
          title: title.trim(),
          type,
          scope,
          category: category || null,
          external_url: externalUrl.trim() || null,
          content: content || null,
          image_url: imageUrl.trim() || null,
          client_ids: scope === 'assigned' ? selectedClientIds : [],
        }
        if (editingItem) {
          await api.post('/admin/admin-resource-update', { id: editingItem.id, ...payload })
        } else {
          await api.post('/admin/admin-resource-store', payload)
        }
      }
      toast.success(editingItem ? 'Recurso actualizado' : 'Recurso creado')
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
      await api.post('/admin/admin-resource-delete', { id: deletingItem.id })
      toast.success('Eliminado')
      setDeleteDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar')
    }
  }

  const filteredClients = allClients.filter(c => c.label.toLowerCase().includes(clientSearch.toLowerCase()))

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Recursos</CardTitle>
          <Button onClick={openCreate}><PlusIcon className='size-4 mr-2' /> Nuevo recurso</Button>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col sm:flex-row gap-2 mb-4'>
            <div className='relative flex-1'>
              <SearchIcon className='absolute left-2.5 top-2.5 size-4 text-muted-foreground' />
              <Input className='pl-8' placeholder='Buscar por título o contenido...' value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={v => setTypeFilter(v ?? 'all')}>
              <SelectTrigger className='w-full sm:w-[160px]'><SelectValue placeholder='Tipo' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los tipos</SelectItem>
                {RESOURCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={scopeFilter} onValueChange={v => setScopeFilter(v ?? 'all')}>
              <SelectTrigger className='w-full sm:w-[160px]'><SelectValue placeholder='Ámbito' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Compartidos y asignados</SelectItem>
                <SelectItem value='shared'>Solo compartidos</SelectItem>
                <SelectItem value='assigned'>Solo asignados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v ?? 'all')}>
              <SelectTrigger className='w-full sm:w-[180px]'><SelectValue placeholder='Sección' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las secciones</SelectItem>
                {Object.entries(ALL_CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[56px]'></TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ámbito</TableHead>
                  <TableHead>Sección</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead className='w-[120px]'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className='h-24 text-center'>
                      <div className='flex justify-center'>
                        <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.image_url ? <img src={item.image_url} alt='' className='size-9 rounded object-cover' /> : <div className='size-9 rounded bg-muted flex items-center justify-center text-muted-foreground'><ImageIcon className='size-4' /></div>}</TableCell>
                      <TableCell className='font-medium'>{item.title}</TableCell>
                      <TableCell><Badge variant='outline'>{RESOURCE_TYPES.find(t => t.value === item.type)?.label || item.type}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={item.scope === 'shared' ? 'secondary' : 'outline'}>
                          {item.scope === 'shared' ? 'Compartido' : 'Asignado'}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {item.category ? ALL_CATEGORY_LABELS[item.category] : '— sin sección —'}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {item.scope === 'shared'
                          ? 'Todos los clientes'
                          : (item.assigned_clients?.length
                              ? item.assigned_clients.map(clientLabel).join(', ')
                              : '— sin asignar —')}
                      </TableCell>
                      <TableCell>
                        <div className='flex gap-2'>
                          <Button variant='outline' size='sm' onClick={() => openEdit(item)}>
                            <PencilIcon className='size-3' />
                          </Button>
                          <Button variant='destructive' size='sm' onClick={() => { setDeletingItem(item); setDeleteDialogOpen(true) }}>
                            <TrashIcon className='size-3' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className='h-24 text-center'>No se encontraron recursos.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar recurso' : 'Nuevo recurso'}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título</FieldLabel>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder='Título del recurso' />
            </Field>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Tipo</FieldLabel>
                <Select value={type} onValueChange={v => setType(v ?? 'article')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Ámbito</FieldLabel>
                <Select value={scope} onValueChange={v => handleScopeChange(v ?? 'shared')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field className='gap-2'>
              <FieldLabel>Sección (dónde se muestra en la app)</FieldLabel>
              <Select value={category || undefined} onValueChange={v => setCategory(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Sin sección' /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS[scope as 'shared' | 'assigned'].map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Portada</FieldLabel>
              <div className='flex items-center gap-3'>
                {imagePreview ? (
                  <div className='relative shrink-0'>
                    <img src={imagePreview} alt='' className='size-16 rounded-md border object-cover' />
                    <button type='button' onClick={() => { setImageFile(null); setImagePreview(null); setImageUrl('') }} className='absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center'>
                      <XIcon className='size-3' />
                    </button>
                  </div>
                ) : (
                  <div className='size-16 rounded-md border border-dashed flex items-center justify-center text-muted-foreground shrink-0'>
                    <ImageIcon className='size-6' />
                  </div>
                )}
                <div className='flex-1 space-y-2'>
                  <Input type='file' accept='image/png,image/jpeg,image/gif' onChange={handlePickImage} className='text-sm' />
                  <Input placeholder='...o pega una URL de imagen' value={imageUrl} onChange={e => { setImageUrl(e.target.value); setImageFile(null); setImagePreview(e.target.value || null) }} />
                </div>
              </div>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>URL externa (para tipo Vídeo/Enlace)</FieldLabel>
              <Input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder='https://...' />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Contenido (HTML)</FieldLabel>
              <textarea
                className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[160px] w-full rounded-md border px-3 py-2 text-sm font-mono focus-visible:ring-2 focus-visible:ring-offset-2'
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder='<h1>Título</h1><p>Contenido...</p>'
              />
            </Field>

            {scope === 'assigned' && (
              <Field className='gap-2'>
                <FieldLabel>Asignar a clientes ({selectedClientIds.length} seleccionados)</FieldLabel>
                <Input
                  placeholder='Buscar cliente...'
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className='mb-1'
                />
                <ScrollArea className='h-[200px] rounded-md border p-2'>
                  {filteredClients.length === 0 ? (
                    <p className='text-sm text-muted-foreground text-center py-4'>Sin resultados</p>
                  ) : filteredClients.map(c => (
                    <label key={c.id} className='flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 cursor-pointer text-sm'>
                      <Checkbox checked={selectedClientIds.includes(c.id)} onCheckedChange={() => toggleClient(c.id)} />
                      {c.label}
                    </label>
                  ))}
                </ScrollArea>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? 'Guardando...' : editingItem ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Eliminar recurso</DialogTitle></DialogHeader>
          <p>¿Seguro que quieres eliminar este recurso?</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
