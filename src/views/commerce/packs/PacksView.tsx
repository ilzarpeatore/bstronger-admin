import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  CopyIcon,
  ExternalLinkIcon,
  ImageIcon,
  MessageCircleIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import PackEditor from './PackEditor'
import {
  fetchOptions,
  fetchPacks,
  fetchPackStats,
  formatDuration,
  formatPrice,
  shareOnWhatsApp,
  type Option,
  type Pack,
  type PackStats,
} from './packs-api'

// Página Packs (2026-10-01): packs de pago único vendidos en la web, con
// formulario propio (sin campos de suscripción), vista previa, enlace para
// compartir y ventas por pack. Los planes de suscripción siguen en /plans.

type Options = { programs: Option[]; mealPlans: Option[]; habits: Option[]; resources: Option[] }

const EMPTY_OPTIONS: Options = { programs: [], mealPlans: [], habits: [], resources: [] }

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

function statusBadge(p: Pack) {
  if (!p.is_active) return <Badge variant="outline">Inactivo</Badge>
  if (p.sold_on_web) return <Badge>A la venta</Badge>
  return <Badge variant="secondary">Borrador</Badge>
}

export default function PacksView() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [stats, setStats] = useState<PackStats[]>([])
  const [options, setOptions] = useState<Options>(EMPTY_OPTIONS)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Pack | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleting, setDeleting] = useState<Pack | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, s] = await Promise.all([fetchPacks(), fetchPackStats().catch(() => [] as PackStats[])])
      setPacks(p)
      setStats(s)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los packs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetchOptions().then(setOptions)
  }, [load])

  // Un pack puede tener ventas en varias monedas si se cambió: se suman por plan.
  const statsByPack = useMemo(() => {
    const map = new Map<number, PackStats[]>()
    for (const s of stats) map.set(s.plan_id, [...(map.get(s.plan_id) ?? []), s])
    return map
  }, [stats])

  const totals = useMemo(() => {
    const revenueByCurrency = new Map<string, number>()
    let purchases = 0
    let registered = 0
    let notRegistered = 0
    for (const s of stats) {
      purchases += s.purchases
      registered += s.registered
      notRegistered += s.not_registered
      revenueByCurrency.set(s.currency, (revenueByCurrency.get(s.currency) ?? 0) + s.revenue)
    }
    const revenue = revenueByCurrency.size
      ? [...revenueByCurrency].map(([cur, amount]) => formatPrice(amount, cur)).join(' + ')
      : formatPrice(0)
    return { purchases, registered, notRegistered, revenue }
  }, [stats])

  const copyLink = async (p: Pack) => {
    if (!p.pack_url) return
    try {
      await navigator.clipboard.writeText(p.pack_url)
      toast.success('Enlace copiado')
    } catch {
      toast.error('No se pudo copiar; selecciónalo a mano')
    }
  }

  const remove = async () => {
    if (!deleting) return
    try {
      await api.delete(`/admin/plans/${deleting.id}`)
      toast.success('Pack eliminado')
      setDeleting(null)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  const registeredPct = totals.purchases ? Math.round((totals.registered / totals.purchases) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Packs</h1>
          <p className="text-sm text-muted-foreground">
            Programas de pago único que se venden en la web y llegan solos a la app.{' '}
            <Link to="/pack-purchases" className="underline underline-offset-4">Ver compras</Link>
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setEditorOpen(true)
          }}
        >
          <PlusIcon className="size-4" /> Nuevo pack
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Ingresos" value={totals.revenue} hint="Sin contar devoluciones" />
        <StatTile label="Compras" value={String(totals.purchases)} />
        <StatTile label="Ya en la app" value={String(totals.registered)} hint={totals.purchases ? `${registeredPct}% de los compradores` : undefined} />
        <StatTile label="Sin registrar todavía" value={String(totals.notRegistered)} hint="Reciben un recordatorio a los 3 y 10 días" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tus packs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pack</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">En la app</TableHead>
                <TableHead>Enlace</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Cargando...</TableCell>
                </TableRow>
              ) : packs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    Aún no tienes packs. Crea el primero con «Nuevo pack».
                  </TableCell>
                </TableRow>
              ) : (
                packs.map((p) => {
                  const rows = statsByPack.get(p.id) ?? []
                  const purchases = rows.reduce((n, r) => n + r.purchases, 0)
                  const registered = rows.reduce((n, r) => n + r.registered, 0)
                  const revenue = rows.length ? rows.map((r) => formatPrice(r.revenue, r.currency)).join(' + ') : '—'
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                          ) : (
                            <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                              <ImageIcon className="size-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{formatDuration(p.invoice_period ?? 1, p.invoice_interval ?? 'month')}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatPrice(p.price, p.currency)}</TableCell>
                      <TableCell>{statusBadge(p)}</TableCell>
                      <TableCell className="text-right tabular-nums">{purchases}</TableCell>
                      <TableCell className="text-right tabular-nums">{revenue}</TableCell>
                      <TableCell className="text-right tabular-nums">{purchases ? `${registered}/${purchases}` : '—'}</TableCell>
                      <TableCell>
                        {p.pack_url && p.is_active ? (
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => copyLink(p)} title={p.pack_url}>
                              <CopyIcon className="size-4" /> Copiar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => shareOnWhatsApp(p.name, p.pack_url!)} title="Compartir por WhatsApp">
                              <MessageCircleIcon className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => window.open(p.pack_url!, '_blank', 'noopener')} title="Abrir en la web">
                              <ExternalLinkIcon className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Publícalo para tener enlace</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing(p)
                              setEditorOpen(true)
                            }}
                            title="Editar"
                          >
                            <PencilIcon className="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(p)} title="Eliminar">
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PackEditor
        open={editorOpen}
        pack={editing}
        options={options}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false)
          load()
        }}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar «{deleting?.name}»?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Dejará de venderse y su enlace dejará de funcionar. Si alguien ya lo compró, mejor desactívalo en vez de
            eliminarlo para conservar el historial.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
