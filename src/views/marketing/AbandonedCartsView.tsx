import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2Icon, Clock3Icon, MousePointerClickIcon, RotateCcwIcon, SearchIcon, ShoppingCartIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { clickIdLabel, formatDate, formatMoney, formatNumber, originLabel, Pager, percent, PER_PAGE, StatTile, type Pagination } from './shared'

// Intentos de compra de packs en la web (cada clic en "Comprar" crea una
// sesión de Stripe). Si caduca sin pago es una cesta abandonada; si la persona
// aceptó comunicaciones en el pago, recibe un único email para retomarla.

type Attempt = {
  id: number
  plan: { id: number; name: string } | null
  email: string | null
  status: 'started' | 'completed' | 'expired' | 'recovered'
  amount: number | null
  recovery_consent: boolean
  recovery_email_sent_at: string | null
  utm_source: string | null
  utm_campaign: string | null
  referrer_host: string | null
  click_id_type: string | null
  created_at: string | null
  expired_at: string | null
  completed_at: string | null
}

type Summary = { started: number; completed: number; abandoned: number; recovered: number; in_progress: number }

const statusLabels: Record<Attempt['status'], string> = {
  started: 'En curso',
  completed: 'Pagada',
  expired: 'Abandonada',
  recovered: 'Recuperada',
}

const statusVariant: Record<Attempt['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  started: 'outline',
  completed: 'default',
  expired: 'destructive',
  recovered: 'secondary',
}

function recoveryText(a: Attempt) {
  if (a.status === 'recovered') return 'Pagó con el enlace del recordatorio'
  if (a.status !== 'expired') return '—'
  if (a.recovery_email_sent_at) return `Recordatorio enviado el ${formatDate(a.recovery_email_sent_at)}`
  if (!a.email) return 'No llegó a dejar su email'
  if (!a.recovery_consent) return 'No aceptó comunicaciones: no se le escribe'
  return 'Sin recordatorio (ya lo compró o se le escribió hace poco)'
}

const STATUS_OPTIONS = [
  { value: 'expired', label: 'Abandonadas' },
  { value: 'recovered', label: 'Recuperadas' },
  { value: 'completed', label: 'Pagadas' },
  { value: 'started', label: 'En curso' },
  { value: 'all', label: 'Todos los intentos' },
]

export default function AbandonedCartsView() {
  const [items, setItems] = useState<Attempt[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('expired')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page) })
      if (search.trim()) params.set('search', search.trim())
      if (status !== 'all') params.set('status', status)
      const res = await api.get<{ data: Attempt[]; summary?: Summary; pagination?: Pagination }>(
        `/admin/checkout-attempts?${params.toString()}`,
      )
      setItems(res.data ?? [])
      setSummary(res.summary ?? null)
      setTotalPages(Math.max(1, res.pagination?.totalPages ?? 1))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las cestas')
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const paid = summary ? summary.completed + summary.recovered : 0
  const finished = summary ? summary.started - summary.in_progress : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Clics en «Comprar» (30 días)"
          value={summary ? formatNumber(summary.started) : '—'}
          icon={MousePointerClickIcon}
          hint={summary?.in_progress ? `${summary.in_progress} aún en curso` : undefined}
        />
        <StatTile
          label="Pagadas"
          value={summary ? formatNumber(paid) : '—'}
          icon={CheckCircle2Icon}
          hint={summary ? `Conversión ${percent(paid, finished)}` : undefined}
        />
        <StatTile
          label="Abandonadas"
          value={summary ? formatNumber(summary.abandoned + summary.recovered) : '—'}
          icon={ShoppingCartIcon}
          hint={summary ? `${percent(summary.abandoned + summary.recovered, finished)} de las terminadas` : undefined}
        />
        <StatTile
          label="Recuperadas"
          value={summary ? formatNumber(summary.recovered) : '—'}
          icon={RotateCcwIcon}
          hint={summary ? `${percent(summary.recovered, summary.abandoned + summary.recovered)} de las abandonadas` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cestas abandonadas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cada vez que alguien pulsa «Comprar» en un pack se abre un pago en Stripe. Si no lo completa en unas horas, cuenta
            como abandonada. Solo quien marcó en el pago que acepta comunicaciones recibe un único recordatorio con un
            enlace para terminar la compra.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-60 flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9!"
              />
            </div>
            <Select
              items={STATUS_OPTIONS}
              value={status}
              onValueChange={(v) => {
                if (!v) return
                setStatus(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Pack</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Recordatorio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Cargando...</TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {status === 'expired' ? 'No hay cestas abandonadas' : 'No hay intentos de compra'}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{formatDate(a.created_at, true)}</TableCell>
                    <TableCell className="font-medium">
                      {a.plan?.name ?? '—'}
                      {a.amount !== null ? <div className="text-xs font-normal text-muted-foreground">{formatMoney(a.amount)}</div> : null}
                    </TableCell>
                    <TableCell>{a.email ?? <span className="text-muted-foreground">Sin email</span>}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[a.status]}>
                        {a.status === 'started' ? <Clock3Icon className="size-3" /> : null}
                        {statusLabels[a.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>{originLabel(a)}</div>
                      {a.click_id_type ? <div className="text-xs text-muted-foreground">Clic en anuncio: {clickIdLabel(a.click_id_type)}</div> : null}
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal text-xs text-muted-foreground">{recoveryText(a)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </CardContent>
      </Card>
    </div>
  )
}
