import { fuzzyMatch } from '@/lib/textSearch'
import { useState, useEffect, useCallback } from 'react'
import { SendIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import CrudView from '@/views/CrudView'

type User = { id: number; name?: string; first_name?: string; last_name?: string; email: string }
type Template = { id: number; title: string; message: string }
type Audience = 'all' | 'selected'

const userLabel = (u: User) => u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || `Usuario #${u.id}`

const SendPushCard = () => {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])

  const [audience, setAudience] = useState<Audience>('all')
  const [users, setUsers] = useState<User[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set())

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.get('/admin/push-notifications?per_page=-1')
      .then(res => setTemplates(res.data?.data || res.data || []))
      .catch(() => { /* plantillas son opcionales, no bloquear el envío */ })
  }, [])

  const loadUsers = useCallback(() => {
    if (usersLoaded || usersLoading) return
    setUsersLoading(true)
    api.get('/admin/users?per_page=500')
      .then(res => { setUsers(res.data?.data || res.data || []); setUsersLoaded(true) })
      .catch(() => toast.error('No se pudieron cargar los clientes'))
      .finally(() => setUsersLoading(false))
  }, [usersLoaded, usersLoading])

  useEffect(() => { if (audience === 'selected') loadUsers() }, [audience, loadUsers])

  const applyTemplate = (id: string | null) => {
    setTemplateId(id ?? '')
    const t = templates.find(x => String(x.id) === id)
    if (t) { setTitle(t.title); setMessage(t.message) }
  }

  const toggleUser = (id: number) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredUsers = userSearch
    ? users.filter(u => fuzzyMatch(userSearch, userLabel(u), u.email))
    : users

  const toggleAllFiltered = () => {
    const allSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.id))
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      filteredUsers.forEach(u => allSelected ? next.delete(u.id) : next.add(u.id))
      return next
    })
  }

  const canSubmit = title.trim() !== '' && message.trim() !== '' && (audience === 'all' || selectedUserIds.size > 0)

  const resetForm = () => {
    setTitle('')
    setMessage('')
    setTemplateId('')
    setSelectedUserIds(new Set())
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        message: message.trim(),
        audience,
      }
      if (templateId) payload.push_notification_id = Number(templateId)
      if (audience === 'selected') payload.user_ids = Array.from(selectedUserIds)

      const res = await api.post('/admin/push-notifications-send', payload)
      const count = res?.data?.recipient_count
      toast.success(count != null ? `Envío en curso a ${count} usuario(s).` : 'Envío en curso.')
      setConfirmOpen(false)
      resetForm()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo enviar la notificación')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enviar notificación push</CardTitle>
        <CardDescription>Manda un push real a todos los usuarios de la app o a una selección de clientes.</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {templates.length > 0 && (
          <Field className='gap-2'>
            <FieldLabel>Cargar desde plantilla (opcional)</FieldLabel>
            <Select value={templateId} onValueChange={applyTemplate}>
              <SelectTrigger className='w-full sm:w-96'><SelectValue placeholder='— Escribir un mensaje nuevo —' /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field className='gap-2'>
          <FieldLabel>Título</FieldLabel>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder='Título de la notificación' />
        </Field>

        <Field className='gap-2'>
          <FieldLabel>Mensaje</FieldLabel>
          <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder='Mensaje' />
        </Field>

        <Field className='gap-2'>
          <FieldLabel>Destinatarios</FieldLabel>
          <Select value={audience} onValueChange={v => setAudience(v as Audience)}>
            <SelectTrigger className='w-full sm:w-72'><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos los usuarios</SelectItem>
              <SelectItem value='selected'>Selección de clientes</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {audience === 'selected' && (
          <div className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <Input placeholder='Buscar cliente...' value={userSearch} onChange={e => setUserSearch(e.target.value)} className='w-full sm:w-64' />
              <Badge variant='secondary'>{selectedUserIds.size} seleccionado(s)</Badge>
            </div>
            <div className='rounded-md border max-h-72 overflow-y-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[50px]'>
                      <Checkbox
                        checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.id))}
                        onCheckedChange={toggleAllFiltered}
                      />
                    </TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow><TableCell colSpan={3} className='h-16 text-center text-sm text-muted-foreground'>Cargando clientes...</TableCell></TableRow>
                  ) : filteredUsers.length ? (
                    filteredUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell><Checkbox checked={selectedUserIds.has(u.id)} onCheckedChange={() => toggleUser(u.id)} /></TableCell>
                        <TableCell>{userLabel(u)}</TableCell>
                        <TableCell>{u.email}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={3} className='h-16 text-center text-sm text-muted-foreground'>Sin resultados.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className='flex justify-end'>
          <Button onClick={() => setConfirmOpen(true)} disabled={!canSubmit}>
            <SendIcon className='size-4 mr-2' />
            {audience === 'all' ? 'Enviar a todos' : `Enviar a ${selectedUserIds.size} cliente(s)`}
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar envío</DialogTitle>
            <DialogDescription>
              {audience === 'all'
                ? 'Se enviará esta notificación push a TODOS los usuarios de la app. Esta acción no se puede deshacer.'
                : `Se enviará esta notificación push a ${selectedUserIds.size} cliente(s) seleccionado(s). Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>
          <div className='rounded-md border p-3 bg-muted/50 space-y-1'>
            <p className='text-sm font-medium'>{title || '(sin título)'}</p>
            <p className='text-sm text-muted-foreground'>{message || '(sin mensaje)'}</p>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirmOpen(false)} disabled={sending}>Cancelar</Button>
            <Button onClick={handleSend} disabled={sending}>{sending ? 'Enviando...' : 'Confirmar y enviar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

const PushNotificationView = () => (
  <div className='space-y-6'>
    <SendPushCard />
    <CrudView
      title='Plantillas de notificaciones push'
      endpoint='/admin/push-notifications'
      fields={[
        { name: 'title', label: 'Título', required: true },
        { name: 'message', label: 'Mensaje', type: 'textarea', required: true },
      ]}
      columns={[
        { id: 'id', header: 'ID', accessorKey: 'id' },
        { id: 'title', header: 'Título', accessorKey: 'title' },
        { id: 'message', header: 'Mensaje', accessorKey: 'message' },
      ]}
    />
  </div>
)

export default PushNotificationView
