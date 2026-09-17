import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, TagIcon, LoaderIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router'
import { TableRowsSkeleton } from '@/components/shared/skeletons'

type ClientTag = { id: number; title: string; color: string }

type UserItem = {
  id: number
  first_name: string
  last_name: string
  email: string
  username: string
  phone_number: string | null
  gender: string | null
  status: string
  is_personal_client?: boolean
  created_at: string
}

const UsersView = () => {
  const navigate = useNavigate()
  const [items, setItems] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<UserItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<UserItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})

  const [tags, setTags] = useState<ClientTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [togglingPersonal, setTogglingPersonal] = useState<number | null>(null)

  useEffect(() => {
    api.get('/admin/client-tag-list').then(res => setTags(res.data || [])).catch(() => {})
  }, [])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      if (selectedTagIds.length > 0) {
        const params = new URLSearchParams()
        selectedTagIds.forEach(id => params.append('tag_ids[]', String(id)))
        const res = await api.get(`/admin/clients-filter-by-tags?${params}`)
        setItems(res.data || [])
      } else {
        const params = new URLSearchParams({ per_page: '100' })
        if (search) params.set('search', search)
        const res = await api.get(`/admin/users?${params}`)
        setItems(res.data?.data || res.data || [])
      }
    } catch {
      toast.error('No se pudieron cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }, [search, selectedTagIds])

  useEffect(() => { fetchItems() }, [fetchItems])

  const toggleTagFilter = (id: number) => {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const openCreate = () => {
    setEditingItem(null)
    // Decisión de negocio (2026-09-17): por defecto 1:1, no Free -- el coach
    // desmarca a mano para los que correspondan.
    setFormData({ is_personal_client: true })
    setDialogOpen(true)
  }

  const openEdit = (item: UserItem) => {
    setEditingItem(item)
    setFormData({
      first_name: item.first_name,
      last_name: item.last_name,
      email: item.email,
      username: item.username,
      phone_number: item.phone_number || '',
      gender: item.gender || '',
      status: item.status,
      is_personal_client: !!item.is_personal_client,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!editingItem) {
      if (!formData.first_name?.trim()) { toast.error('El nombre es obligatorio'); return }
      if (!formData.last_name?.trim()) { toast.error('El apellido es obligatorio'); return }
      if (!formData.email?.trim()) { toast.error('El correo electrónico es obligatorio'); return }
      if (!formData.username?.trim()) { toast.error('El nombre de usuario es obligatorio'); return }
      if (!formData.password || formData.password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return }
    }
    setSubmitting(true)
    try {
      if (editingItem) {
        const payload = { ...formData }
        if (!payload.password) delete payload.password
        await api.put(`/admin/users/${editingItem.id}`, payload)
        toast.success('Usuario actualizado')
      } else {
        await api.post('/admin/users', formData)
        toast.success('Usuario creado')
      }
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTogglePersonalClient = async (user: UserItem, checked: boolean) => {
    setItems(prev => prev.map(u => u.id === user.id ? { ...u, is_personal_client: checked } : u))
    setTogglingPersonal(user.id)
    try {
      await api.put(`/admin/users/${user.id}`, { is_personal_client: checked })
      toast.success(checked ? 'Acceso completo (1:1) activado' : 'Acceso establecido como Free')
    } catch {
      setItems(prev => prev.map(u => u.id === user.id ? { ...u, is_personal_client: !checked } : u))
      toast.error('No se pudo actualizar el nivel de acceso')
    } finally {
      setTogglingPersonal(null)
    }
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    try {
      await api.delete(`/admin/users/${deletingItem.id}`)
      toast.success('Usuario eliminado')
      setDeleteDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo eliminar')
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Usuarios</CardTitle>
          <div className='flex items-center gap-2'>
            <Input placeholder='Buscar usuarios...' value={search} onChange={e => setSearch(e.target.value)} className='w-64' disabled={selectedTagIds.length > 0} />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant='outline'>
                    <TagIcon className='size-4 mr-2' />
                    {selectedTagIds.length > 0 ? `Etiquetas (${selectedTagIds.length})` : 'Filtrar por etiqueta'}
                  </Button>
                }
              />
              <DropdownMenuContent align='end' className='w-56'>
                <DropdownMenuLabel>Filtrar por etiqueta de cliente</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tags.length === 0 ? (
                  <div className='px-2 py-1.5 text-sm text-muted-foreground'>Aún no hay etiquetas creadas</div>
                ) : (
                  tags.map(tag => (
                    <DropdownMenuCheckboxItem
                      key={tag.id}
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => toggleTagFilter(tag.id)}
                    >
                      {tag.title}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
                {selectedTagIds.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <Button variant='ghost' size='sm' className='w-full' onClick={() => setSelectedTagIds([])}>
                      Limpiar filtro
                    </Button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={openCreate}><PlusIcon className='size-4 mr-2' /> Añadir usuario</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[60px]'>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo electrónico</TableHead>
                  <TableHead>Nombre de usuario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className='w-[120px]'>Acceso</TableHead>
                  <TableHead className='w-[150px]'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRowsSkeleton rows={6} columns={7} />
                ) : items.length ? (
                  items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell className='font-medium'>{item.first_name} {item.last_name}</TableCell>
                      <TableCell>{item.email}</TableCell>
                      <TableCell className='text-muted-foreground'>@{item.username}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <Switch
                            checked={!!item.is_personal_client}
                            disabled={togglingPersonal === item.id}
                            onCheckedChange={(checked) => handleTogglePersonalClient(item, checked)}
                            className='scale-75'
                          />
                          {togglingPersonal === item.id ? (
                            <LoaderIcon className='size-3 animate-spin text-muted-foreground' />
                          ) : (
                            <span className='text-xs font-medium whitespace-nowrap'>{item.is_personal_client ? '1:1' : 'Free'}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex gap-2'>
                          <Button variant='outline' size='sm' onClick={() => navigate(`/users/${item.id}`)}>
                            <EyeIcon className='size-3' />
                          </Button>
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
                    <TableCell colSpan={7} className='h-24 text-center'>No se encontraron usuarios.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar usuario' : 'Crear usuario'}</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Nombre</FieldLabel>
              <Input value={formData.first_name || ''} onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Apellido</FieldLabel>
              <Input value={formData.last_name || ''} onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Correo electrónico</FieldLabel>
              <Input type='email' value={formData.email || ''} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Nombre de usuario</FieldLabel>
              <Input value={formData.username || ''} onChange={e => setFormData(p => ({ ...p, username: e.target.value }))} />
            </Field>
            {!editingItem && (
              <Field className='gap-2'>
                <FieldLabel>Contraseña (mínimo 8 caracteres)</FieldLabel>
                <Input type='password' value={formData.password || ''} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} placeholder='Introduce la contraseña' />
              </Field>
            )}
            <Field className='gap-2'>
              <FieldLabel>Teléfono</FieldLabel>
              <Input value={formData.phone_number || ''} onChange={e => setFormData(p => ({ ...p, phone_number: e.target.value }))} />
            </Field>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Género</FieldLabel>
                <Select value={formData.gender || ''} onValueChange={v => setFormData(p => ({ ...p, gender: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar' /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='male'>Masculino</SelectItem>
                    <SelectItem value='female'>Femenino</SelectItem>
                    <SelectItem value='other'>Otro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Estado</FieldLabel>
                <Select value={formData.status || 'active'} onValueChange={v => setFormData(p => ({ ...p, status: v ?? 'active' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='active'>Activo</SelectItem>
                    <SelectItem value='banned'>Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field className='gap-2'>
              <div className='flex items-center justify-between rounded-md border px-3 py-2.5'>
                <div>
                  <FieldLabel className='mb-0.5'>Acceso completo (cliente de entrenamiento personal)</FieldLabel>
                  <p className='text-xs text-muted-foreground'>Acceso completo automático, sin necesidad de comprar ningún paquete.</p>
                </div>
                <Switch
                  checked={!!formData.is_personal_client}
                  onCheckedChange={checked => setFormData(p => ({ ...p, is_personal_client: checked }))}
                />
              </div>
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
          <DialogHeader><DialogTitle>Eliminar usuario</DialogTitle></DialogHeader>
          <p>¿Estás seguro de que quieres eliminar este usuario?</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default UsersView
