import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, TrophyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type ChallengeScore = {
  id: number
  client_id: number
  current_value: number
  rank: number | null
  client?: { id: number; name?: string; first_name?: string; last_name?: string; email: string }
}

type Challenge = {
  id: number
  title: string
  description: string | null
  metric_type: string
  target_metric: number | null
  start_date: string
  end_date: string
  scope: 'shared' | 'personal'
  scores?: ChallengeScore[]
}

type SelectOption = { id: number; label: string }

const clientLabel = (c?: ChallengeScore['client']) =>
  c ? (c.name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email) : 'Desconocido'

const ChallengesView = () => {
  const [items, setItems] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({ scope: 'shared' })

  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null)
  const [clients, setClients] = useState<SelectOption[]>([])
  const [scoreClientId, setScoreClientId] = useState('')
  const [scoreValue, setScoreValue] = useState('')
  const [savingScore, setSavingScore] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/challenge-list?per_page=100')
      setItems(res.data || [])
    } catch {
      toast.error('Error al cargar los desafíos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/admin/users?per_page=500')
      const data = res.data?.data || res.data || []
      setClients(data.map((u: any) => ({ id: u.id, label: `${u.name || u.display_name || (u.first_name + ' ' + u.last_name)} (${u.email})` })))
    } catch {
      toast.error('Error al cargar los clientes')
    }
  }, [])

  const openLeaderboard = async (challenge: Challenge) => {
    setActiveChallenge(challenge)
    setScoreClientId('')
    setScoreValue('')
    setLeaderboardOpen(true)
    if (clients.length === 0) fetchClients()
    try {
      const res = await api.get(`/admin/challenge-leaderboard?id=${challenge.id}`)
      setActiveChallenge(res.data)
    } catch {
      toast.error('Error al cargar la clasificación')
    }
  }

  const openCreate = () => {
    setFormData({ scope: 'shared' })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.title || !formData.metric_type || !formData.start_date || !formData.end_date) {
      toast.error('El título, el tipo de métrica, la fecha de inicio y la fecha de fin son obligatorios')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/admin/challenge-store', formData)
      toast.success('Desafío creado')
      setDialogOpen(false)
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || 'Error al crear el desafío')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateScore = async () => {
    if (!activeChallenge || !scoreClientId || !scoreValue) {
      toast.error('Selecciona un cliente e introduce un valor')
      return
    }
    setSavingScore(true)
    try {
      await api.post('/admin/challenge-update-score', {
        challenge_id: activeChallenge.id,
        client_id: Number(scoreClientId),
        current_value: Number(scoreValue),
      })
      toast.success('Puntuación actualizada')
      const res = await api.get(`/admin/challenge-leaderboard?id=${activeChallenge.id}`)
      setActiveChallenge(res.data)
      setScoreClientId('')
      setScoreValue('')
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar la puntuación')
    } finally {
      setSavingScore(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Desafíos</CardTitle>
          <Button onClick={openCreate}>
            <PlusIcon className='size-4 mr-2' /> Nuevo desafío
          </Button>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Métrica</TableHead>
                  <TableHead>Ámbito</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Participantes</TableHead>
                  <TableHead className='w-[140px]'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className='h-24 text-center'>
                      <div className='flex justify-center'>
                        <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className='font-medium'>{item.title}</TableCell>
                      <TableCell>{item.metric_type}</TableCell>
                      <TableCell><Badge variant='secondary'>{item.scope}</Badge></TableCell>
                      <TableCell>{item.start_date} → {item.end_date}</TableCell>
                      <TableCell>{item.scores?.length ?? 0}</TableCell>
                      <TableCell>
                        <Button variant='outline' size='sm' onClick={() => openLeaderboard(item)}>
                          <TrophyIcon className='size-4 mr-1.5' /> Clasificación
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className='h-24 text-center'>No hay desafíos activos.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>Nuevo desafío</DialogTitle>
          </DialogHeader>
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Título</FieldLabel>
              <Input value={formData.title || ''} onChange={e => setFormData((p: any) => ({ ...p, title: e.target.value }))} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel>Descripción</FieldLabel>
              <Input value={formData.description || ''} onChange={e => setFormData((p: any) => ({ ...p, description: e.target.value }))} />
            </Field>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Tipo de métrica</FieldLabel>
                <Input placeholder='p. ej. pasos, pérdida de peso' value={formData.metric_type || ''} onChange={e => setFormData((p: any) => ({ ...p, metric_type: e.target.value }))} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Métrica objetivo</FieldLabel>
                <Input type='number' value={formData.target_metric || ''} onChange={e => setFormData((p: any) => ({ ...p, target_metric: e.target.value }))} />
              </Field>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <Field className='gap-2'>
                <FieldLabel>Fecha de inicio</FieldLabel>
                <Input type='date' value={formData.start_date || ''} onChange={e => setFormData((p: any) => ({ ...p, start_date: e.target.value }))} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel>Fecha de fin</FieldLabel>
                <Input type='date' value={formData.end_date || ''} onChange={e => setFormData((p: any) => ({ ...p, end_date: e.target.value }))} />
              </Field>
            </div>
            <Field className='gap-2'>
              <FieldLabel>Ámbito</FieldLabel>
              <Select value={formData.scope || 'shared'} onValueChange={v => setFormData((p: any) => ({ ...p, scope: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='shared'>Compartido (todos los clientes compiten juntos)</SelectItem>
                  <SelectItem value='personal'>Personal (objetivo individual)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaderboardOpen} onOpenChange={setLeaderboardOpen}>
        <DialogContent className='max-w-lg max-h-[80vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{activeChallenge?.title} — Clasificación</DialogTitle>
          </DialogHeader>

          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[60px]'>Posición</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeChallenge?.scores?.length ? (
                  activeChallenge.scores.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{s.rank ?? '-'}</TableCell>
                      <TableCell>{clientLabel(s.client)}</TableCell>
                      <TableCell>{s.current_value}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className='h-16 text-center text-muted-foreground'>Aún no hay puntuaciones.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <FieldGroup className='gap-3 pt-2 border-t'>
            <FieldLabel>Actualizar la puntuación de un cliente</FieldLabel>
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
              <Select value={scoreClientId} onValueChange={v => setScoreClientId(v ?? '')}>
                <SelectTrigger className='w-full sm:flex-1'><SelectValue placeholder='Seleccionar cliente' /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type='number' placeholder='Valor' className='w-full sm:w-28' value={scoreValue} onChange={e => setScoreValue(e.target.value)} />
              <Button onClick={handleUpdateScore} disabled={savingScore}>
                {savingScore ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button variant='outline' onClick={() => setLeaderboardOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ChallengesView
