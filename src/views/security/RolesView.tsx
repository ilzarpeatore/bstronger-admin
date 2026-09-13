import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type Permission = { id: number; name: string }
type Role = { id: number; name: string; permissions: Permission[] }

// FIX (auditoría 2026-09-13): antes wrapper de CrudView con un único campo
// "name" -- el backend (RoleController::store/update) ya soporta
// permissions[] + syncPermissions(), inalcanzable desde el panel. CrudView
// no soporta relaciones many-to-many (solo campos escalares), así que esta
// vista pasa a bespoke en vez de forzarlo ahí.
export default function RolesView() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [deletingRole, setDeletingRole] = useState<Role | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/roles')
      setRoles(res.data || [])
    } catch {
      toast.error('No se pudieron cargar los roles')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  useEffect(() => {
    api.get('/admin/permissions').then(res => setPermissions(res.data || res || [])).catch(() => {})
  }, [])

  const openCreate = () => {
    setEditingRole(null)
    setName('')
    setSelectedPermissionIds([])
    setDialogOpen(true)
  }

  const openEdit = (role: Role) => {
    setEditingRole(role)
    setName(role.name)
    setSelectedPermissionIds((role.permissions || []).map(p => p.id))
    setDialogOpen(true)
  }

  const togglePermission = (id: number, checked: boolean) => {
    setSelectedPermissionIds(prev => checked ? [...prev, id] : prev.filter(p => p !== id))
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('El nombre del rol es obligatorio'); return }
    setSubmitting(true)
    try {
      const payload = { name: name.trim(), permissions: selectedPermissionIds }
      if (editingRole) {
        await api.put(`/admin/roles/${editingRole.id}`, payload)
        toast.success('Rol actualizado')
      } else {
        await api.post('/admin/roles', payload)
        toast.success('Rol creado')
      }
      setDialogOpen(false)
      fetchRoles()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo guardar el rol')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingRole) return
    try {
      await api.delete(`/admin/roles/${deletingRole.id}`)
      toast.success('Rol eliminado')
      setDeleteDialogOpen(false)
      fetchRoles()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo eliminar el rol')
    }
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle>Roles</CardTitle>
        <Button onClick={openCreate}><PlusIcon className='size-4 mr-2' /> Nuevo rol</Button>
      </CardHeader>
      <CardContent>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead className='w-[100px]'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className='h-24 text-center'>
                  <div className='flex justify-center'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
                </TableCell></TableRow>
              ) : roles.length ? roles.map(role => (
                <TableRow key={role.id}>
                  <TableCell>{role.id}</TableCell>
                  <TableCell className='font-medium'>{role.name}</TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-1 max-w-md'>
                      {(role.permissions || []).length === 0
                        ? <span className='text-xs text-muted-foreground'>Sin permisos</span>
                        : role.permissions.map(p => <Badge key={p.id} variant='secondary' className='text-xs'>{p.name}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex gap-2'>
                      <Button variant='outline' size='sm' onClick={() => openEdit(role)} aria-label='Editar'>
                        <PencilIcon className='size-4' />
                      </Button>
                      <Button variant='destructive' size='sm' onClick={() => { setDeletingRole(role); setDeleteDialogOpen(true) }} aria-label='Eliminar'>
                        <TrashIcon className='size-4' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={4} className='h-24 text-center'>Sin resultados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
          </DialogHeader>
          <Field className='gap-2'>
            <FieldLabel>Nombre del rol</FieldLabel>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder='ej. sub-coach' />
          </Field>
          <Field className='gap-2'>
            <FieldLabel>Permisos</FieldLabel>
            <div className='flex flex-col gap-1.5 max-h-[280px] overflow-y-auto border rounded-md p-3'>
              {permissions.length === 0 ? (
                <span className='text-sm text-muted-foreground'>No hay permisos creados todavía.</span>
              ) : permissions.map(p => (
                <label key={p.id} className='flex items-center gap-2 text-sm cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={selectedPermissionIds.includes(p.id)}
                    onChange={e => togglePermission(p.id, e.target.checked)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </Field>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Guardando...' : editingRole ? 'Actualizar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar rol?</DialogTitle>
          </DialogHeader>
          <p className='text-sm text-muted-foreground'>
            Se eliminará el rol "{deletingRole?.name}". Los usuarios que lo tengan asignado lo perderán. Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
