import { useState, useEffect, useCallback } from 'react'
import { UsersIcon, CheckIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type User = { id: number; name?: string; first_name?: string; last_name?: string; email: string }
type SelectOption = { id: number; label: string }

const BulkAssignView = () => {
  const [users, setUsers] = useState<User[]>([])
  const [workouts, setWorkouts] = useState<SelectOption[]>([])
  const [diets, setDiets] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set())
  const [assignType, setAssignType] = useState<'workout' | 'diet'>('workout')
  const [selectedItemId, setSelectedItemId] = useState('')

  const fetchOptions = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, workoutsRes, dietsRes] = await Promise.all([
        api.get('/admin/users?per_page=500'),
        api.get('/admin/workouts?per_page=500'),
        api.get('/admin/diets?per_page=500'),
      ])
      setUsers(usersRes.data?.data || usersRes.data || [])
      setWorkouts((workoutsRes.data?.data || workoutsRes.data || []).map((w: any) => ({ id: w.id, label: w.title })))
      setDiets((dietsRes.data?.data || dietsRes.data || []).map((d: any) => ({ id: d.id, label: d.title || d.name })))
    } catch {
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOptions() }, [fetchOptions])

  const filteredUsers = users

  const toggleUser = (id: number) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set())
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)))
    }
  }

  const items = assignType === 'workout' ? workouts : diets
  const endpoint = assignType === 'workout' ? '/admin/assign-workout' : '/admin/assign-diet'
  const idKey = assignType === 'workout' ? 'workout_id' : 'diet_id'

  const handleSubmit = async () => {
    if (selectedUserIds.size === 0) {
      toast.error('Selecciona al menos un cliente')
      return
    }
    if (!selectedItemId) {
      toast.error(`Selecciona un ${assignType === 'workout' ? 'entrenamiento' : 'dieta'}`)
      return
    }
    setSubmitting(true)
    let successCount = 0
    // FIX (auditoría 2026-09-13): antes solo se contaban los fallos, sin
    // identificar a quién -- con un fallo parcial no había forma de saber
    // a quién reintentar sin arriesgarse a duplicar los que sí funcionaron.
    const failedUsers: User[] = []
    for (const userId of selectedUserIds) {
      try {
        await api.post(endpoint, { user_id: userId, [idKey]: Number(selectedItemId) })
        successCount++
      } catch {
        const u = users.find(x => x.id === userId)
        if (u) failedUsers.push(u)
      }
    }
    setSubmitting(false)
    if (failedUsers.length === 0) {
      toast.success(`${successCount} asignación(es) creada(s) correctamente`)
      setSelectedUserIds(new Set())
    } else {
      const names = failedUsers.map(userLabel).join(', ')
      toast.warning(`${successCount} exitosas, ${failedUsers.length} fallidas: ${names}`, { duration: 8000 })
      // Deja seleccionados solo los que fallaron, para poder reintentar sin
      // volver a asignar (y potencialmente duplicar) a los que sí funcionaron.
      setSelectedUserIds(new Set(failedUsers.map(u => u.id)))
    }
    setSelectedItemId('')
  }

  const userLabel = (u: User) => u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || `Usuario #${u.id}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asignación masiva</CardTitle>
        <CardDescription>
          Selecciona múltiples clientes y asígnales el mismo entrenamiento o dieta en una sola acción.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-wrap items-end gap-4'>
          <Field className='gap-2 flex-1 min-w-[200px]'>
            <FieldLabel>Tipo de asignación</FieldLabel>
            <Select value={assignType} onValueChange={v => { setAssignType(v as 'workout' | 'diet'); setSelectedItemId('') }}>
              <SelectTrigger className='w-48'><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='workout'>Entrenamiento</SelectItem>
                <SelectItem value='diet'>Dieta</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field className='gap-2 flex-1 min-w-[200px]'>
            <FieldLabel>{assignType === 'workout' ? 'Entrenamiento' : 'Dieta'}</FieldLabel>
            <Select value={selectedItemId} onValueChange={v => setSelectedItemId(v ?? '')}>
              <SelectTrigger><SelectValue placeholder={`Seleccionar ${assignType === 'workout' ? 'entrenamiento' : 'dieta'}`} /></SelectTrigger>
              <SelectContent>
                {items.map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button onClick={handleSubmit} disabled={submitting || selectedUserIds.size === 0 || !selectedItemId}>
            <UsersIcon className='size-4 mr-2' />
            {submitting ? 'Asignando...' : `Asignar a ${selectedUserIds.size} cliente(s)`}
          </Button>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[50px]'>
                  <Checkbox
                    checked={filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className='w-[100px]'>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>
                    <div className='flex justify-center'>
                      <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length ? (
                filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUserIds.has(user.id)}
                        onCheckedChange={() => toggleUser(user.id)}
                      />
                    </TableCell>
                    <TableCell>{userLabel(user)}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {selectedUserIds.has(user.id) ? (
                        <Badge variant='default'><CheckIcon className='size-3 mr-1' /> Seleccionado</Badge>
                      ) : (
                        <Badge variant='secondary'><XIcon className='size-3 mr-1' /> —</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>No se encontraron clientes.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default BulkAssignView
