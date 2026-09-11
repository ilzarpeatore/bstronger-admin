import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { AlertTriangleIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api'

type OnboardingRow = {
  id: number; first_name: string; last_name: string; display_name: string | null; email: string; username: string
  coach_id: number | null; flagged_for_review: boolean; flagged_for_review_at: string | null
  onboarding_completed: boolean; onboarding_completed_at: string | null
}

export default function OnboardingListView() {
  const navigate = useNavigate()
  const [items, setItems] = useState<OnboardingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [flaggedFilter, setFlaggedFilter] = useState('all')
  const [completedFilter, setCompletedFilter] = useState('all')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (search) params.set('search', search)
      if (flaggedFilter !== 'all') params.set('flagged_for_review', flaggedFilter)
      if (completedFilter !== 'all') params.set('completed', completedFilter)
      const res = await api.get(`/admin/admin-onboarding-list?${params}`)
      setItems(res.data?.data?.data || res.data?.data || res.data || [])
    } catch {
      toast.error('No se pudo cargar el listado de onboarding')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [search, flaggedFilter, completedFilter])

  useEffect(() => { fetchItems() }, [fetchItems])

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between flex-wrap gap-3'>
        <div>
          <CardTitle>Onboarding</CardTitle>
          <p className='text-sm text-muted-foreground'>Estado del onboarding v2 (PAR-Q, entrenamiento, nutrición) por cliente</p>
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          <Select value={flaggedFilter} onValueChange={v => setFlaggedFilter(v ?? 'all')}>
            <SelectTrigger className='w-52'><SelectValue placeholder='Revisión' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos</SelectItem>
              <SelectItem value='1'>Marcados para revisión</SelectItem>
              <SelectItem value='0'>Sin marcar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={completedFilter} onValueChange={v => setCompletedFilter(v ?? 'all')}>
            <SelectTrigger className='w-44'><SelectValue placeholder='Estado' /></SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos los estados</SelectItem>
              <SelectItem value='1'>Completado</SelectItem>
              <SelectItem value='0'>Pendiente</SelectItem>
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
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Revisión</TableHead>
                <TableHead>Completado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className='h-24 text-center'><div className='flex justify-center'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div></TableCell></TableRow>
              ) : items.length ? (
                items.map(item => (
                  <TableRow key={item.id} className='cursor-pointer hover:bg-muted/50' onClick={() => navigate(`/users/${item.id}/onboarding`)}>
                    <TableCell className='text-sm font-medium'>{item.display_name || `${item.first_name} ${item.last_name}`}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{item.email}</TableCell>
                    <TableCell><Badge variant={item.onboarding_completed ? 'default' : 'secondary'}>{item.onboarding_completed ? 'Completado' : 'Pendiente'}</Badge></TableCell>
                    <TableCell>{item.flagged_for_review ? <Badge variant='destructive' className='gap-1'><AlertTriangleIcon className='size-3' /> Revisar</Badge> : <span className='text-muted-foreground text-sm'>—</span>}</TableCell>
                    <TableCell className='text-xs text-muted-foreground'>{item.onboarding_completed_at ? new Date(item.onboarding_completed_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className='h-24 text-center'>Sin resultados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
