import { useCallback, useEffect, useState } from 'react'
import { LinkIcon, MailIcon, SearchIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { api } from '@/lib/api'

// Compras de packs hechas en la web propia con Stripe (Bckbs docs/PACKS_WEB.md).
// Normalmente se vinculan solas por email; esta pantalla es para los casos que
// no: reenviar el email con el código o vincular a mano a un cliente.

type PackPurchase = {
  id: number
  plan: { id: number; name: string } | null
  email: string
  customer_name: string | null
  amount: number
  currency: string
  status: 'paid' | 'claimed' | 'refunded'
  redeem_code: string
  user: { id: number; name: string; email: string } | null
  started: boolean
  claimed_at: string | null
  created_at: string | null
}

type Pagination = { total_items?: number; currentPage?: number; totalPages?: number }

const PER_PAGE = 25

const statusLabels: Record<PackPurchase['status'], string> = {
  paid: 'Sin vincular',
  claimed: 'Vinculada',
  refunded: 'Devuelta',
}

const statusVariant: Record<PackPurchase['status'], 'default' | 'secondary' | 'destructive'> = {
  paid: 'secondary',
  claimed: 'default',
  refunded: 'destructive',
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function formatAmount(p: PackPurchase) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: p.currency || 'EUR' }).format(p.amount)
}

export default function PackPurchasesView() {
  const [items, setItems] = useState<PackPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [linking, setLinking] = useState<PackPurchase | null>(null)
  const [linkEmail, setLinkEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page) })
      if (search.trim()) params.set('search', search.trim())
      if (status !== 'all') params.set('status', status)
      const res = await api.get<{ data: PackPurchase[]; pagination?: Pagination }>(`/admin/pack-purchases?${params.toString()}`)
      setItems(res.data ?? [])
      setTotalPages(Math.max(1, res.pagination?.totalPages ?? 1))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar las compras')
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const resend = async (p: PackPurchase) => {
    try {
      await api.post('/admin/pack-purchases-resend', { id: p.id })
      toast.success(`Email reenviado a ${p.email}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo reenviar')
    }
  }

  const link = async () => {
    if (!linking || !linkEmail.trim()) return
    setSaving(true)
    try {
      await api.post('/admin/pack-purchases-link', { id: linking.id, user_email: linkEmail.trim() })
      toast.success('Compra vinculada')
      setLinking(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo vincular')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compras de packs</CardTitle>
        <p className="text-sm text-muted-foreground">
          Packs comprados en la web. Se asignan solos cuando el cliente se registra en la app con el mismo email o
          introduce su código; aquí puedes reenviar el email o vincular la compra a mano.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-60 flex-1">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por email o código..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
          <Select
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
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="paid">Sin vincular</SelectItem>
              <SelectItem value="claimed">Vinculadas</SelectItem>
              <SelectItem value="refunded">Devueltas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Pack</TableHead>
              <TableHead>Comprador</TableHead>
              <TableHead>Importe</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cliente en la app</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Cargando...</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No hay compras</TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.created_at)}</TableCell>
                  <TableCell className="font-medium">{p.plan?.name ?? '—'}</TableCell>
                  <TableCell>
                    <div>{p.email}</div>
                    {p.customer_name ? <div className="text-xs text-muted-foreground">{p.customer_name}</div> : null}
                  </TableCell>
                  <TableCell>{formatAmount(p)}</TableCell>
                  <TableCell className="font-mono tracking-wider">{p.redeem_code}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status]}>{statusLabels[p.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {p.user ? (
                      <div>
                        <div>{p.user.name || p.user.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.started ? 'Pack activo' : 'Empieza al terminar el cuestionario'}
                        </div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {p.status !== 'refunded' ? (
                        <Button variant="outline" size="sm" onClick={() => resend(p)} title="Reenviar email con el código">
                          <MailIcon className="size-4" />
                        </Button>
                      ) : null}
                      {p.status === 'paid' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLinking(p)
                            setLinkEmail('')
                          }}
                          title="Vincular a un cliente"
                        >
                          <LinkIcon className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-3 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span>Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={!!linking} onOpenChange={(open) => !open && setLinking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular compra a un cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            «{linking?.plan?.name}» se pagó con {linking?.email}. Escribe el email con el que el cliente se registró en
            la app; el pack empezará cuando termine el cuestionario inicial (o ya, si lo tiene hecho).
          </p>
          <Input
            type="email"
            placeholder="email@cliente.com"
            value={linkEmail}
            onChange={(e) => setLinkEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && link()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinking(null)}>Cancelar</Button>
            <Button onClick={link} disabled={saving || !linkEmail.trim()}>Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
