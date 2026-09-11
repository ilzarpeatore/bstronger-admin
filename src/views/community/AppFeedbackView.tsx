import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type FeedbackUser = { id: number; first_name: string; last_name: string; email: string }
type Feedback = {
  id: number; user_id: number; type: 'feature_request' | 'bug_report'; title: string; description: string
  section: 'workout' | 'nutrition' | 'habits' | 'metrics' | 'other'; section_other: string | null
  diagnostics_log: string | null; app_version: string | null; platform: 'ios' | 'android' | null
  status: 'open' | 'reviewed' | 'closed'; created_at: string; user?: FeedbackUser
}

const TYPE_LABELS: Record<string, string> = { feature_request: 'Sugerencia', bug_report: 'Error' }
const SECTION_LABELS: Record<string, string> = { workout: 'Entrenamiento', nutrition: 'Nutrición', habits: 'Hábitos', metrics: 'Métricas', other: 'Otro' }
const STATUS_LABELS: Record<string, string> = { open: 'Abierto', reviewed: 'Revisado', closed: 'Cerrado' }

function truncate(str: string, len = 60) { return str && str.length > len ? str.slice(0, len) + '…' : str }

export default function AppFeedbackView() {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<Feedback | null>(null)
  const [updating, setUpdating] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (search) params.set('search', search)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (sectionFilter !== 'all') params.set('section', sectionFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await api.get(`/admin/admin-app-feedback-list?${params}`)
      setItems(res.data?.data?.data || res.data?.data || res.data || [])
    } catch {
      toast.error('No se pudo cargar el feedback')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, sectionFilter, statusFilter])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleStatusChange = async (id: number, status: Feedback['status']) => {
    setUpdating(true)
    try {
      await api.post('/admin/admin-app-feedback-update', { id, status })
      toast.success('Estado actualizado')
      setSelected(prev => prev ? { ...prev, status } : null)
      setItems(prev => prev.map(f => f.id === id ? { ...f, status } : f))
    } catch {
      toast.error('No se pudo actualizar el estado')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between flex-wrap gap-3'>
          <CardTitle>Feedback de la app</CardTitle>
          <div className='flex items-center gap-2 flex-wrap'>
            <Select value={typeFilter} onValueChange={v => setTypeFilter(v ?? 'all')}>
              <SelectTrigger className='w-40'><SelectValue placeholder='Tipo' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los tipos</SelectItem>
                <SelectItem value='feature_request'>Sugerencia</SelectItem>
                <SelectItem value='bug_report'>Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={v => setSectionFilter(v ?? 'all')}>
              <SelectTrigger className='w-40'><SelectValue placeholder='Sección' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las secciones</SelectItem>
                {Object.entries(SECTION_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
              <SelectTrigger className='w-36'><SelectValue placeholder='Estado' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los estados</SelectItem>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder='Buscar...' value={search} onChange={e => setSearch(e.target.value)} className='w-56' />
          </div>
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Sección</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className='h-24 text-center'><div className='flex justify-center'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div></TableCell></TableRow>
                ) : items.length ? (
                  items.map(item => (
                    <TableRow key={item.id} className='cursor-pointer hover:bg-muted/50' onClick={() => setSelected(item)}>
                      <TableCell className='text-sm'>{item.user ? `${item.user.first_name} ${item.user.last_name}` : `#${item.user_id}`}</TableCell>
                      <TableCell><Badge variant={item.type === 'bug_report' ? 'destructive' : 'outline'}>{TYPE_LABELS[item.type]}</Badge></TableCell>
                      <TableCell className='text-sm'>{item.section === 'other' && item.section_other ? item.section_other : SECTION_LABELS[item.section]}</TableCell>
                      <TableCell className='text-sm font-medium'>{truncate(item.title)}</TableCell>
                      <TableCell className='text-sm capitalize'>{item.platform ?? '—'}</TableCell>
                      <TableCell><Badge variant={item.status === 'open' ? 'default' : item.status === 'reviewed' ? 'secondary' : 'outline'}>{STATUS_LABELS[item.status]}</Badge></TableCell>
                      <TableCell className='text-xs text-muted-foreground'>{new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={7} className='h-24 text-center'>Sin resultados.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className='max-w-2xl'>
          {selected && (<>
            <DialogHeader>
              <DialogTitle className='flex items-center gap-2'>
                <Badge variant={selected.type === 'bug_report' ? 'destructive' : 'outline'}>{TYPE_LABELS[selected.type]}</Badge>
                {selected.title}
              </DialogTitle>
            </DialogHeader>
            <div className='space-y-4 max-h-[60vh] overflow-y-auto pr-1'>
              <div className='grid grid-cols-2 gap-3 text-sm'>
                <div><span className='text-muted-foreground'>Usuario: </span><span className='font-medium'>{selected.user ? `${selected.user.first_name} ${selected.user.last_name} (${selected.user.email})` : `#${selected.user_id}`}</span></div>
                <div><span className='text-muted-foreground'>Sección: </span><span className='font-medium'>{selected.section === 'other' && selected.section_other ? selected.section_other : SECTION_LABELS[selected.section]}</span></div>
                <div><span className='text-muted-foreground'>Plataforma: </span><span className='font-medium capitalize'>{selected.platform ?? '—'}</span></div>
                <div><span className='text-muted-foreground'>Versión de la app: </span><span className='font-medium'>{selected.app_version ?? '—'}</span></div>
              </div>
              <div>
                <p className='text-sm text-muted-foreground mb-1'>Descripción</p>
                <p className='text-sm whitespace-pre-wrap'>{selected.description}</p>
              </div>
              {selected.diagnostics_log && (
                <div>
                  <p className='text-sm text-muted-foreground mb-1'>Log de diagnóstico</p>
                  <pre className='text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto'>{selected.diagnostics_log}</pre>
                </div>
              )}
            </div>
            <DialogFooter className='gap-2'>
              {(['open', 'reviewed', 'closed'] as const).map(status => (
                <Button key={status} size='sm' variant={selected.status === status ? 'default' : 'outline'} disabled={updating || selected.status === status} onClick={() => handleStatusChange(selected.id, status)}>
                  {STATUS_LABELS[status]}
                </Button>
              ))}
            </DialogFooter>
          </>)}
        </DialogContent>
      </Dialog>
    </>
  )
}
