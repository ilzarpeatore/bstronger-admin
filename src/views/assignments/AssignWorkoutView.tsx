import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, TrashIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type AssignWorkoutItem = {
  id: number
  user_id: number
  workout_id: number
  user?: { id: number; name?: string; first_name?: string; last_name?: string; email: string }
  workout?: { id: number; title: string }
}

type SelectOption = { id: number; label: string }

const AssignWorkoutView = () => {
  const [items, setItems] = useState<AssignWorkoutItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<AssignWorkoutItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  const [userId, setUserId] = useState('')
  const [workoutId, setWorkoutId] = useState('')

  const [users, setUsers] = useState<SelectOption[]>([])
  const [workouts, setWorkouts] = useState<SelectOption[]>([])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (search) params.set('user_id', search)
      const res = await api.get(`/admin/assign-workout?${params}`)
      setItems(res.data?.data || [])
    } catch {
      toast.error('Error al cargar las asignaciones')
    } finally {
      setLoading(false)
    }
  }, [search])

  const fetchOptions = async () => {
    try {
      const [usersRes, workoutsRes] = await Promise.all([
        api.get('/admin/users?per_page=500'),
        api.get('/admin/workouts?per_page=500')
      ])
      const userData = usersRes.data?.data || usersRes.data || []
      const workoutData = workoutsRes.data?.data || workoutsRes.data || []
      setUsers(userData.map((u: any) => ({ id: u.id, label: `${u.name || u.first_name + ' ' + u.last_name} (${u.email})` })))
      setWorkouts(workoutData.map((w: any) => ({ id: w.id, label: w.title })))
    } catch {
      toast.error('Error al cargar usuarios/entrenamientos')
    }
  }

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleOpenCreate = () => {
    setUserId('')
    setWorkoutId('')
    fetchOptions()
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!userId || !workoutId) {
      toast.error('Selecciona un usuario y un entrenamiento')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/admin/assign-workout', { user_id: Number(userId), workout_id: Number(workoutId) })
      toast.success('Entrenamiento asignado correctamente')
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || err?.data?.message || 'Error al asignar el entrenamiento')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingItem) return
    try {
      await api.delete(`/admin/assign-workout/${deletingItem.id}`)
      toast.success('Asignación eliminada')
      setDeleteDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al eliminar')
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Asignar entrenamiento a usuarios</CardTitle>
          <div className='flex items-center gap-2'>
            <Input placeholder='Filtrar por ID de usuario...' value={search} onChange={e => setSearch(e.target.value)} className='w-48' />
            <Button variant='outline' size='sm' onClick={fetchItems}><RefreshCwIcon className='size-4' /></Button>
            <Button onClick={handleOpenCreate}><PlusIcon className='size-4 mr-2' /> Asignar entrenamiento</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Entrenamiento</TableHead>
                  <TableHead className='w-[80px]'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center'>
                      <div className='flex justify-center'>
                        <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>{item.user?.name || item.user?.first_name || `Usuario #${item.user_id}`}</TableCell>
                      <TableCell>{item.user?.email || '-'}</TableCell>
                      <TableCell>{item.workout?.title || `Entrenamiento #${item.workout_id}`}</TableCell>
                      <TableCell>
                        <Button variant='destructive' size='sm' onClick={() => { setDeletingItem(item); setDeleteDialogOpen(true) }}>
                          <TrashIcon className='size-4' />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center'>No se encontraron asignaciones.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Asignar entrenamiento a usuario</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Usuario</FieldLabel>
              <Select value={userId} onValueChange={v => setUserId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Seleccionar usuario' /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Entrenamiento</FieldLabel>
              <Select value={workoutId} onValueChange={v => setWorkoutId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder='Seleccionar entrenamiento' /></SelectTrigger>
                <SelectContent>
                  {workouts.map(w => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Asignando...' : 'Asignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar asignación</DialogTitle>
          </DialogHeader>
          <p>¿Seguro que quieres eliminar esta asignación de entrenamiento?</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AssignWorkoutView
