import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, CopyIcon, TrashIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type InviteItem = {
  id: number
  code: string
  first_name: string | null
  last_name: string | null
  email: string | null
  used_at: string | null
  used_by: string | null
  expires_at: string | null
  is_used: boolean
  is_expired: boolean
  created_at: string
}

const PersonalClientInvitesView = () => {
  const [items, setItems] = useState<InviteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '' })
  const [newCode, setNewCode] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InviteItem | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/personal-client-invites?per_page=100')
      setItems(res.data?.data || res.data || [])
    } catch {
      toast.error('No se pudieron cargar las invitaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openCreate = () => {
    setForm({ first_name: '', last_name: '', email: '' })
    setNewCode(null)
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const payload: Record<string, string> = {}
      if (form.first_name.trim()) payload.first_name = form.first_name.trim()
      if (form.last_name.trim()) payload.last_name = form.last_name.trim()
      if (form.email.trim()) payload.email = form.email.trim()
      const res = await api.post('/admin/personal-client-invites', payload)
      const code = res.data?.data?.code || res.data?.code
      setNewCode(code)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo crear la invitación')
    } finally {
      setCreating(false)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success('Código copiado')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/admin/personal-client-invites/${deleteTarget.id}`)
      toast.success('Invitación revocada')
      setDeleteTarget(null)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo revocar la invitación')
    }
  }

  const statusBadge = (item: InviteItem) => {
    if (item.is_used) return <Badge variant='secondary'>Usado por {item.used_by || '—'}</Badge>
    if (item.is_expired) return <Badge variant='destructive'>Expirada</Badge>
    return <Badge variant='default'>Activa</Badge>
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div>
            <CardTitle>Invitaciones de clientes personales</CardTitle>
            <p className='text-sm text-muted-foreground mt-1'>
              Genera un código y compártelo a mano (WhatsApp, SMS...) — quien se registre con él queda como cliente de entrenamiento personal 1:1 automáticamente.
            </p>
          </div>
          <Button onClick={openCreate}><PlusIcon className='size-4 mr-2' /> Generar invitación</Button>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className='w-[100px]'>Acciones</TableHead>
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
                      <TableCell className='font-mono'>{item.code}</TableCell>
                      <TableCell>{[item.first_name, item.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                      <TableCell>{statusBadge(item)}</TableCell>
                      <TableCell className='text-muted-foreground'>{item.expires_at ? new Date(item.expires_at).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <div className='flex gap-2'>
                          <Button variant='outline' size='sm' onClick={() => copyCode(item.code)}>
                            <CopyIcon className='size-3' />
                          </Button>
                          {!item.is_used && (
                            <Button variant='destructive' size='sm' onClick={() => setDeleteTarget(item)}>
                              <TrashIcon className='size-3' />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center'>Aún no hay invitaciones.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar invitación</DialogTitle>
          </DialogHeader>
          {newCode ? (
            <div className='space-y-3'>
              <p className='text-sm text-muted-foreground'>Comparte este código con el cliente (WhatsApp, SMS...):</p>
              <div className='flex items-center gap-2'>
                <Input value={newCode} readOnly className='font-mono text-lg text-center' />
                <Button onClick={() => copyCode(newCode)}><CopyIcon className='size-4' /></Button>
              </div>
            </div>
          ) : (
            <FieldGroup className='gap-4'>
              <p className='text-xs text-muted-foreground'>Todos los campos son opcionales — solo para identificar la invitación en la lista.</p>
              <Field className='gap-2'>
                <FieldLabel>Nombre</FieldLabel>
                <Input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Apellido</FieldLabel>
                <Input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Correo electrónico</FieldLabel>
                <Input type='email' value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </Field>
            </FieldGroup>
          )}
          <DialogFooter>
            {newCode ? (
              <Button onClick={() => setCreateOpen(false)}>Listo</Button>
            ) : (
              <>
                <Button variant='outline' onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={creating}>{creating ? 'Generando...' : 'Generar'}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revocar invitación</DialogTitle></DialogHeader>
          <p>¿Estás seguro de que quieres revocar este código de invitación? Ya no podrá usarse.</p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant='destructive' onClick={handleDelete}>Revocar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default PersonalClientInvitesView
