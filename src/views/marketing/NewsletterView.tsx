import { useCallback, useEffect, useState } from 'react'
import { DownloadIcon, MailCheckIcon, MailQuestionIcon, MailXIcon, SearchIcon, Trash2Icon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDate, formatNumber, originLabel, Pager, PER_PAGE, StatTile, type Pagination } from './shared'

// Suscriptores de la newsletter de la web (pie de página y lista de espera),
// con doble opt-in: solo los "confirmados" pueden recibir envíos.

type Subscriber = {
  id: number
  email: string
  source: string
  status: 'pending' | 'confirmed' | 'unsubscribed'
  utm_source: string | null
  utm_campaign: string | null
  referrer_host: string | null
  landing_path: string | null
  confirmed_at: string | null
  unsubscribed_at: string | null
  created_at: string | null
}

type Stats = {
  confirmed: number
  pending: number
  unsubscribed: number
  by_source: Record<string, number>
}

const statusLabels: Record<Subscriber['status'], string> = {
  pending: 'Sin confirmar',
  confirmed: 'Confirmado',
  unsubscribed: 'De baja',
}

const statusVariant: Record<Subscriber['status'], 'default' | 'secondary' | 'outline'> = {
  pending: 'secondary',
  confirmed: 'default',
  unsubscribed: 'outline',
}

const sourceLabels: Record<string, string> = {
  footer: 'Pie de página',
  waitlist: 'Lista de espera',
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'pending', label: 'Sin confirmar' },
  { value: 'unsubscribed', label: 'De baja' },
]

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Todos los formularios' },
  { value: 'footer', label: 'Pie de página' },
  { value: 'waitlist', label: 'Lista de espera' },
]

export default function NewsletterView() {
  const [items, setItems] = useState<Subscriber[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [source, setSource] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [deleting, setDeleting] = useState<Subscriber | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page) })
      if (search.trim()) params.set('search', search.trim())
      if (status !== 'all') params.set('status', status)
      if (source !== 'all') params.set('source', source)
      const res = await api.get<{ data: Subscriber[]; pagination?: Pagination }>(`/admin/newsletter-subscribers?${params.toString()}`)
      setItems(res.data ?? [])
      setTotalPages(Math.max(1, res.pagination?.totalPages ?? 1))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los suscriptores')
    } finally {
      setLoading(false)
    }
  }, [search, status, source, page])

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get<{ data: Stats }>('/admin/newsletter-stats')
      setStats(res.data)
    } catch {
      setStats(null)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const exportCsv = async () => {
    try {
      const date = new Date().toISOString().slice(0, 10)
      await api.download('/admin/newsletter-export?status=confirmed', `newsletter-${date}.csv`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar')
    }
  }

  const remove = async () => {
    if (!deleting) return
    try {
      await api.post('/admin/newsletter-delete', { id: deleting.id })
      toast.success('Suscriptor eliminado')
      setDeleting(null)
      load()
      loadStats()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  const total = stats ? stats.confirmed + stats.pending + stats.unsubscribed : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Confirmados"
          value={stats ? formatNumber(stats.confirmed) : '—'}
          icon={MailCheckIcon}
          hint={
            stats && Object.keys(stats.by_source).length
              ? Object.entries(stats.by_source)
                  .map(([k, n]) => `${sourceLabels[k] ?? k}: ${n}`)
                  .join(' · ')
              : 'Pueden recibir envíos'
          }
        />
        <StatTile
          label="Sin confirmar"
          value={stats ? formatNumber(stats.pending) : '—'}
          icon={MailQuestionIcon}
          hint="Aún no han pulsado el enlace del email"
        />
        <StatTile
          label="De baja"
          value={stats ? formatNumber(stats.unsubscribed) : '—'}
          icon={MailXIcon}
          hint={total ? `${formatNumber(total)} altas en total` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Newsletter</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Altas desde la web con doble confirmación por email. Exporta solo los confirmados para tu herramienta de
                envíos; quien se da de baja no vuelve a aparecer en la exportación.
              </p>
            </div>
            <Button variant="outline" onClick={exportCsv}>
              <DownloadIcon className="size-4" />
              Exportar confirmados (CSV)
            </Button>
          </div>
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
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={SOURCE_OPTIONS}
              value={source}
              onValueChange={(v) => {
                if (!v) return
                setSource(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Formulario" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alta</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Formulario</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="text-right!">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Cargando...</TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No hay suscriptores</TableCell>
                </TableRow>
              ) : (
                items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.created_at, true)}</TableCell>
                    <TableCell className="font-medium">{s.email}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[s.status]}>{statusLabels[s.status]}</Badge>
                      {s.status === 'confirmed' && s.confirmed_at ? (
                        <div className="mt-1 text-xs text-muted-foreground">{formatDate(s.confirmed_at)}</div>
                      ) : s.status === 'unsubscribed' && s.unsubscribed_at ? (
                        <div className="mt-1 text-xs text-muted-foreground">{formatDate(s.unsubscribed_at)}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>{sourceLabels[s.source] ?? s.source}</TableCell>
                    <TableCell>
                      <div>{originLabel(s)}</div>
                      {s.landing_path ? <div className="text-xs text-muted-foreground">Entró por {s.landing_path}</div> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setDeleting(s)} title="Eliminar (derecho de supresión)">
                        <Trash2Icon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el registro por completo (derecho de supresión). Si solo quiere dejar de recibir emails, basta con el
              enlace de baja de cualquier envío.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
