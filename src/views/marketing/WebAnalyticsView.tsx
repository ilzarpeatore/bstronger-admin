import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  EyeIcon,
  MailPlusIcon,
  MegaphoneIcon,
  MousePointerClickIcon,
  ShoppingBagIcon,
  UsersIcon,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { clickIdLabel, formatMoney, formatNumber, percent, StatTile } from './shared'

// Analítica propia de la web, sin cookies (Bckbs docs/MARKETING_WEB.md): un
// "visitante" es un hash diario anónimo, así que no se sigue a nadie de un día
// a otro. Complementa a Google Analytics, que solo mide a quien acepta cookies.

type Analytics = {
  from: string
  to: string
  totals: {
    pageviews: number
    visitors: number
    from_ads: number
    newsletter_signups: number
    checkout_started: number
    purchases: number
  }
  series: { day: string; pageviews: number; visitors: number }[]
  top_pages: { path: string; pageviews: number; visitors: number }[]
  sources: { source: string; visitors: number; paid: number }[]
  devices: Record<string, number>
  ad_clicks: Record<string, number>
  campaigns: {
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    visitors: number
    checkout_started: number
    purchases: number
    revenue: number
    abandoned: number
    newsletter: number
  }[]
  packs: {
    plan_id: number
    name: string
    slug: string | null
    landing_visitors: number
    checkout_started: number
    abandoned: number
    recovered: number
    purchases: number
    revenue: number
    registered: number
    onboarding_done: number
  }[]
}

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
]

const chartConfig = {
  visitors: { label: 'Visitantes', color: 'var(--color-primary)' },
  pageviews: { label: 'Páginas vistas', color: 'var(--chart-2)' },
} satisfies ChartConfig

const deviceLabels: Record<string, string> = { mobile: 'Móvil', desktop: 'Ordenador', tablet: 'Tablet' }

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10)
}

function shortDay(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-6 text-center text-muted-foreground">{text}</TableCell>
    </TableRow>
  )
}

export default function WebAnalyticsView() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const to = new Date()
      const from = new Date(to)
      from.setDate(from.getDate() - (days - 1))
      const res = await api.get<{ data: Analytics }>(`/admin/web-analytics?from=${isoDay(from)}&to=${isoDay(to)}`)
      setData(res.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar la analítica')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  const t = data?.totals
  const devices = useMemo(() => Object.entries(data?.devices ?? {}).sort((a, b) => b[1] - a[1]), [data])
  const deviceTotal = devices.reduce((n, [, v]) => n + v, 0)
  const adClicks = useMemo(() => Object.entries(data?.ad_clicks ?? {}).sort((a, b) => b[1] - a[1]), [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Analítica de la web</h2>
          <p className="text-sm text-muted-foreground">
            Visitas, de dónde llegan (campañas y anuncios) y cuántas acaban en compra. Sin cookies: cuenta a todo el mundo,
            también a quien rechaza el banner.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1">
          {RANGES.map((r) => (
            <Button key={r.days} size="sm" variant={days === r.days ? 'default' : 'ghost'} onClick={() => setDays(r.days)}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatTile label="Visitantes" value={t ? formatNumber(t.visitors) : '—'} icon={UsersIcon} hint="Únicos por día, sumados" />
        <StatTile label="Páginas vistas" value={t ? formatNumber(t.pageviews) : '—'} icon={EyeIcon} />
        <StatTile
          label="Desde anuncios"
          value={t ? formatNumber(t.from_ads) : '—'}
          icon={MegaphoneIcon}
          hint={t ? `${percent(t.from_ads, t.visitors)} de las visitas` : undefined}
        />
        <StatTile label="Altas newsletter" value={t ? formatNumber(t.newsletter_signups) : '—'} icon={MailPlusIcon} />
        <StatTile label="Clics en «Comprar»" value={t ? formatNumber(t.checkout_started) : '—'} icon={MousePointerClickIcon} />
        <StatTile
          label="Compras"
          value={t ? formatNumber(t.purchases) : '—'}
          icon={ShoppingBagIcon}
          hint={t ? `Conversión ${percent(t.purchases, t.visitors)}` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visitas por día</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">Cargando...</div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px]! w-full">
              <AreaChart data={data?.series ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="day"
                  tickFormatter={shortDay}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  minTickGap={24}
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => shortDay(String(v))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area dataKey="pageviews" type="monotone" stroke="var(--color-pageviews)" fill="var(--color-pageviews)" fillOpacity={0.15} />
                <Area dataKey="visitors" type="monotone" stroke="var(--color-visitors)" fill="var(--color-visitors)" fillOpacity={0.3} />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campañas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Visitas que llegaron con parámetros UTM (añádelos a los enlaces de tus anuncios y publicaciones, p. ej.
            <code className="mx-1 rounded bg-muted px-1">?utm_source=meta&utm_campaign=gluteo-otono</code>) y lo que hicieron
            después.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead className="text-right!">Visitantes</TableHead>
                <TableHead className="text-right!">Newsletter</TableHead>
                <TableHead className="text-right!">Clics «Comprar»</TableHead>
                <TableHead className="text-right!">Abandonadas</TableHead>
                <TableHead className="text-right!">Compras</TableHead>
                <TableHead className="text-right!">Conversión</TableHead>
                <TableHead className="text-right!">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data?.campaigns.length ? (
                <EmptyRow cols={8} text="Aún no hay visitas con UTM en este periodo" />
              ) : (
                data.campaigns.map((c) => (
                  <TableRow key={`${c.utm_source}|${c.utm_medium}|${c.utm_campaign}`}>
                    <TableCell>
                      <div className="font-medium">{c.utm_campaign || '(sin nombre de campaña)'}</div>
                      <div className="text-xs text-muted-foreground">{[c.utm_source, c.utm_medium].filter(Boolean).join(' / ') || '—'}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.visitors)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.newsletter)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.checkout_started)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.abandoned)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.purchases)}</TableCell>
                    <TableCell className="text-right tabular-nums">{percent(c.purchases, c.visitors)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(c.revenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embudo por pack</CardTitle>
          <p className="text-sm text-muted-foreground">
            De la página del pack hasta que el cliente empieza en la app. «Registrados» = compras ya vinculadas a una cuenta;
            «Empezaron» = terminaron el cuestionario y tienen el contenido asignado.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pack</TableHead>
                <TableHead className="text-right!">Visitantes página</TableHead>
                <TableHead className="text-right!">Clics «Comprar»</TableHead>
                <TableHead className="text-right!">Abandonadas</TableHead>
                <TableHead className="text-right!">Recuperadas</TableHead>
                <TableHead className="text-right!">Compras</TableHead>
                <TableHead className="text-right!">Registrados</TableHead>
                <TableHead className="text-right!">Empezaron</TableHead>
                <TableHead className="text-right!">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data?.packs.length ? (
                <EmptyRow cols={9} text="No hay packs" />
              ) : (
                data.packs.map((p) => (
                  <TableRow key={p.plan_id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.slug ? <div className="text-xs text-muted-foreground">/packs/{p.slug}</div> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.landing_visitors)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(p.checkout_started)}
                      <div className="text-xs text-muted-foreground">{percent(p.checkout_started, p.landing_visitors)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.abandoned)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.recovered)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(p.purchases)}
                      <div className="text-xs text-muted-foreground">{percent(p.purchases, p.checkout_started)}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.registered)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.onboarding_done)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.revenue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Páginas más vistas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Página</TableHead>
                  <TableHead className="text-right!">Vistas</TableHead>
                  <TableHead className="text-right!">Visitantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.top_pages.length ? (
                  <EmptyRow cols={3} text="Sin visitas en este periodo" />
                ) : (
                  data.top_pages.map((p) => (
                    <TableRow key={p.path}>
                      <TableCell className="max-w-72 truncate font-mono text-xs">{p.path}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.pageviews)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.visitors)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>De dónde llegan</CardTitle>
              <p className="text-sm text-muted-foreground">Fuente UTM, si no la web que enlazó, si no «directo».</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fuente</TableHead>
                    <TableHead className="text-right!">Visitantes</TableHead>
                    <TableHead className="text-right!">De anuncio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data?.sources.length ? (
                    <EmptyRow cols={3} text="Sin visitas en este periodo" />
                  ) : (
                    data.sources.map((s) => (
                      <TableRow key={s.source}>
                        <TableCell>{s.source === 'directo' ? 'Directo' : s.source}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(s.visitors)}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.paid ? formatNumber(s.paid) : '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Dispositivo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos</p>
                ) : (
                  devices.map(([k, n]) => (
                    <div key={k} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{deviceLabels[k] ?? k}</span>
                        <span className="tabular-nums text-muted-foreground">{percent(n, deviceTotal)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(n / deviceTotal) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Clics en anuncios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {adClicks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ninguno. Google, Meta y TikTok añaden su identificador de clic al enlace solos.
                  </p>
                ) : (
                  adClicks.map(([k, n]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span>{clickIdLabel(k)}</span>
                      <span className="tabular-nums">{formatNumber(n)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
