import { useState, useEffect, useCallback } from 'react'
import { Search, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

type Transaction = {
  id: number
  subscriber_name: string
  subscriber_id: number
  plan_name: string
  plan_id: number
  amount_paid_cents: number | null
  amount_paid_eur: number | null
  payment_method: string | null
  payment_notes: string | null
  payment_status: string
  starts_at: string | null
  ends_at: string | null
  status: string
  created_at: string | null
}

const paymentMethods = ['bizum', 'efectivo', 'transferencia', 'stripe', 'otro']
const methodLabels: Record<string, string> = {
  bizum: 'Bizum', efectivo: 'Efectivo', transferencia: 'Transferencia', stripe: 'Stripe', otro: 'Otro',
}

export default function TransactionsView() {
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: '100' })
      if (search) params.set('search', search)
      if (methodFilter !== 'all') params.set('payment_method', methodFilter)
      const res = await api.get(`/admin/reports/transactions?${params}`)
      setItems(res.data?.data || res.data || [])
    } catch {
      toast.error('No se pudieron cargar las transacciones')
    } finally {
      setLoading(false)
    }
  }, [search, methodFilter])

  useEffect(() => { fetchItems() }, [fetchItems])

  const exportCsv = () => {
    const headers = ['ID', 'Cliente', 'Plan', 'Importe (EUR)', 'Método', 'Notas', 'Estado', 'Inicio', 'Fin']
    const rows = items.map(t => [
      t.id, t.subscriber_name, t.plan_name,
      t.amount_paid_eur?.toFixed(2) ?? '-',
      t.payment_method ? methodLabels[t.payment_method] ?? t.payment_method : '-',
      (t.payment_notes ?? '').replace(/,/g, ' '),
      t.payment_status,
      t.starts_at ?? '', t.ends_at ?? '',
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'transacciones.csv'
    a.click()
  }

  const statusBadge = (s: string) => {
    switch (s) {
      case 'active': return <Badge variant="default">Activa</Badge>
      case 'trial': return <Badge className="bg-chart-2/10! text-chart-2!">Prueba</Badge>
      case 'ended': return <Badge variant="secondary">Finalizada</Badge>
      case 'canceled': return <Badge variant="destructive">Cancelada</Badge>
      default: return <Badge variant="outline">{s}</Badge>
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Transacciones</h2>
          <p className="text-sm text-muted-foreground">Historial de pagos y suscripciones</p>
        </div>
        <Button variant="outline" onClick={exportCsv} className="cursor-pointer gap-1.5">
          <Download size={16} /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4 pb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar cliente o plan..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={methodFilter} onValueChange={(v) => v && setMethodFilter(v)}>
            <SelectTrigger className="w-[160px] cursor-pointer">
              <SelectValue placeholder="Método de pago" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los métodos</SelectItem>
              {paymentMethods.map(m => (
                <SelectItem key={m} value={m}>{methodLabels[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                    </TableCell>
                  </TableRow>
                ) : items.length ? (
                  items.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.subscriber_name}</TableCell>
                      <TableCell>{t.plan_name}</TableCell>
                      <TableCell>{t.amount_paid_eur != null ? `€${t.amount_paid_eur.toFixed(2)}` : '—'}</TableCell>
                      <TableCell>{t.payment_method ? methodLabels[t.payment_method] ?? t.payment_method : '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{t.payment_notes || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{t.starts_at || '—'}</TableCell>
                      <TableCell>{statusBadge(t.status)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">Sin transacciones.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
