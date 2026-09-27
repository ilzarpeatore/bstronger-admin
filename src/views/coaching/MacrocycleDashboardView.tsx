import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { Link, useSearchParams } from 'react-router'

import {
  ArrowLeftIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  CheckCircle2Icon,
  ArrowDownCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { api } from '@/lib/api'
import {
  computeBuckets,
  mesoLabel,
  muscleSetsPerWeek,
  musclesOf,
  rangeStatus,
  round1,
  statAvg,
  NO_MUSCLE,
  type Bucket,
  type Granularity,
  type PlanData,
  type References,
  type SetsMode,
  type RangeStatus,
} from '@/lib/macrocycleDashboard'

// Dashboard de KPIs de un macrociclo: SOLO lo planificado por el coach
// (series, reps, RIR/RPE, indicaciones de carga de cada ejercicio de cada
// sesión), nunca lo registrado por el cliente. Datos: GET /admin/macrocycle-plan
// (Bckbs MacrocycleDashboardController). Agregación: src/lib/macrocycleDashboard.ts.

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'week', label: 'Semana a semana' },
  { value: 'meso', label: 'Por mesociclo' },
  { value: 'macro', label: 'Macrociclo entero' },
]

const SETS_MODES: { value: SetsMode; label: string }[] = [
  { value: 'direct', label: 'Series directas' },
  { value: 'indirect', label: 'Directas + indirectas' },
]

// Colores validados con el validador de paleta (dataviz): azul = serie única;
// carga = escala divergente bajar (rojo) ↔ mantener (gris neutro) ↔ subir (azul) + fija (amarillo).
const SERIES_THEME = { light: '#2a78d6', dark: '#3987e5' }
const CARGA_CONFIG = {
  bajar: { label: 'Bajar', theme: { light: '#e34948', dark: '#e66767' } },
  mantener: { label: 'Mantener', theme: { light: '#8a8984', dark: '#b5b4ae' } },
  subir: { label: 'Subir', theme: { light: '#2a78d6', dark: '#3987e5' } },
  fija: { label: 'Carga fija (kg / %)', theme: { light: '#eda100', dark: '#c98500' } },
} satisfies ChartConfig

const STATUS: Record<Exclude<RangeStatus, null>, { label: string; color: string; Icon: typeof CheckCircle2Icon }> = {
  ok: { label: 'En rango', color: '#0ca30c', Icon: CheckCircle2Icon },
  low: { label: 'Bajo MEV', color: '#fab219', Icon: ArrowDownCircleIcon },
  high: { label: 'Sobre MRV', color: '#d03b3b', Icon: AlertTriangleIcon },
}

type Point = { label: string; value: number | null; hint?: string }

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(o => (
        <Button key={o.value} size="sm" variant={value === o.value ? 'default' : 'outline'} onClick={() => onChange(o.value)}>
          {o.label}
        </Button>
      ))}
    </div>
  )
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {detail && <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>}
      </CardContent>
    </Card>
  )
}

/** Evolución de una sola métrica: línea semana a semana, barras por mesociclo / macrociclo. */
function TrendChart({
  data,
  label,
  granularity,
  references = [],
  unit = '',
}: {
  data: Point[]
  label: string
  granularity: Granularity
  references?: { y: number; label: string }[]
  unit?: string
}) {
  const config = { value: { label, theme: SERIES_THEME } } satisfies ChartConfig
  const hasData = data.some(d => d.value != null)
  if (!hasData) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sin datos planificados para esta métrica.</p>
  }
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
      <YAxis tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
      <ChartTooltip
        content={
          <ChartTooltipContent
            labelFormatter={(l, payload) => {
              const hint = (payload?.[0]?.payload as Point | undefined)?.hint
              return hint ? `${l} · ${hint}` : String(l)
            }}
            formatter={v => (
              <span className="flex w-full justify-between gap-4">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">
                  {round1(Number(v))}
                  {unit}
                </span>
              </span>
            )}
          />
        }
      />
      {references.map(r => (
        <ReferenceLine
          key={r.label}
          y={r.y}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          label={{ value: r.label, position: 'right', fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
      ))}
    </>
  )
  return (
    <ChartContainer config={config} className="h-[240px]! w-full">
      {granularity === 'week' ? (
        <LineChart data={data} margin={{ top: 12, right: references.length ? 56 : 12, bottom: 0, left: 0 }}>
          {axes}
          <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={data.length <= 16 ? { r: 4, strokeWidth: 2, stroke: 'var(--background)', fill: 'var(--color-value)' } : false} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ top: 12, right: references.length ? 56 : 12, bottom: 0, left: 0 }}>
          {axes}
          <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
        </BarChart>
      )}
    </ChartContainer>
  )
}

export default function MacrocycleDashboardView() {
  const [searchParams] = useSearchParams()
  const programIds = useMemo(
    () => (searchParams.get('programs') ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0),
    [searchParams],
  )
  const name = searchParams.get('name') ?? 'Macrociclo'

  const [plan, setPlan] = useState<PlanData | null>(null)
  const [references, setReferences] = useState<References>({})
  const [loading, setLoading] = useState(true)

  const [granularity, setGranularity] = useState<Granularity>('week')
  const [setsMode, setSetsMode] = useState<SetsMode>('direct')
  const [selected, setSelected] = useState<number[]>([])
  const [muscle, setMuscle] = useState<string>('')

  const [refsOpen, setRefsOpen] = useState(false)
  const [refsDraft, setRefsDraft] = useState<Record<string, { mev: string; mrv: string }>>({})
  const [savingRefs, setSavingRefs] = useState(false)

  const load = useCallback(async () => {
    if (programIds.length === 0) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const qs = programIds.map(id => `program_ids[]=${id}`).join('&')
      const [planRes, refsRes] = await Promise.all([api.get(`/admin/macrocycle-plan?${qs}`), api.get('/admin/macrocycle-references')])
      const data: PlanData = planRes.data
      setPlan(data)
      setSelected(data.programs.map(p => p.id))
      setReferences(refsRes.data ?? {})
    } catch {
      toast.error('Error al cargar el dashboard del macrociclo')
    } finally {
      setLoading(false)
    }
  }, [programIds])

  useEffect(() => {
    load()
  }, [load])

  const buckets = useMemo(() => (plan ? computeBuckets(plan, granularity, selected) : []), [plan, granularity, selected])
  const weekBuckets = useMemo(() => (plan ? computeBuckets(plan, 'week', selected) : []), [plan, selected])
  const muscles = useMemo(() => musclesOf(buckets, setsMode), [buckets, setsMode])
  const activeMuscle = muscles.includes(muscle) ? muscle : (muscles.find(m => m !== NO_MUSCLE) ?? '')

  const bucketLabel = (b: Bucket) => (b.isDeload ? `${b.label} (D)` : b.label)

  const kpis = useMemo(() => {
    const totalSets = weekBuckets.reduce((a, b) => a + b.totalSets, 0)
    const weeks = weekBuckets.reduce((a, b) => a + b.weeks, 0)
    const deload = weekBuckets.reduce((a, b) => a + b.deloadWeeks, 0)
    const sessions = weekBuckets.reduce((a, b) => a + b.sessions, 0)
    const peak = weekBuckets.reduce<Bucket | null>((best, b) => (!best || b.totalSets > best.totalSets ? b : best), null)
    const merge = (key: 'rir' | 'rpe' | 'reps') =>
      statAvg(
        weekBuckets.reduce<{ sum: number; weight: number; min: number; max: number } | null>((acc, b) => {
          const s = b[key]
          if (!s) return acc
          return acc ? { sum: acc.sum + s.sum, weight: acc.weight + s.weight, min: 0, max: 0 } : { ...s }
        }, null),
      )
    return { totalSets, weeks, deload, sessions, peak, rir: merge('rir'), rpe: merge('rpe'), reps: merge('reps') }
  }, [weekBuckets])

  const openRefs = () => {
    const names = Array.from(new Set([...muscles.filter(m => m !== NO_MUSCLE), ...Object.keys(references)])).sort((a, b) => a.localeCompare(b, 'es'))
    setRefsDraft(
      Object.fromEntries(
        names.map(n => [n, { mev: references[n]?.mev != null ? String(references[n].mev) : '', mrv: references[n]?.mrv != null ? String(references[n].mrv) : '' }]),
      ),
    )
    setRefsOpen(true)
  }

  const saveRefs = async () => {
    setSavingRefs(true)
    try {
      const payload = Object.fromEntries(
        Object.entries(refsDraft)
          .filter(([, r]) => r.mev !== '' || r.mrv !== '')
          .map(([n, r]) => [n, { mev: r.mev === '' ? null : Number(r.mev), mrv: r.mrv === '' ? null : Number(r.mrv) }]),
      )
      const res = await api.post('/admin/macrocycle-references-save', { references: payload })
      setReferences(res.data ?? payload)
      setRefsOpen(false)
      toast.success('Referencias MEV/MRV guardadas')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron guardar las referencias')
    } finally {
      setSavingRefs(false)
    }
  }

  const toggleMeso = (id: number) =>
    setSelected(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      return next.length === 0 ? prev : (plan?.programs.map(p => p.id).filter(p => next.includes(p)) ?? next)
    })

  const perWeekNote = granularity === 'week' ? '' : ' (media por semana)'
  const setsLabel = setsMode === 'direct' ? 'Series directas' : 'Series (directas + indirectas)'
  const activeRef = references[activeMuscle]
  const noSin = buckets.reduce((a, b) => a + b.carga.sin, 0)

  if (programIds.length === 0) {
    return (
      <div className="space-y-4">
        <Link to="/macrociclos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeftIcon className="size-4" /> Macrociclos
        </Link>
        <p className="text-sm text-muted-foreground">Abre el dashboard desde un macrociclo en la página Macrociclos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/macrociclos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <ArrowLeftIcon className="size-4" /> Macrociclos
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Dashboard · {name}</h1>
          <p className="text-sm text-muted-foreground">
            Lo que has planificado (series, reps, RIR/RPE e indicaciones de carga), no lo que registra el cliente.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openRefs} disabled={!plan}>
            <SlidersHorizontalIcon className="mr-2 size-4" />
            MEV / MRV
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCwIcon className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </Button>
        </div>
      </div>

      {plan && plan.skipped_ids.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border p-3 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            {plan.skipped_ids.length === 1 ? 'Un mesociclo no se incluye' : `${plan.skipped_ids.length} mesociclos no se incluyen`} porque no eres su
            coach (programas #{plan.skipped_ids.join(', #')}).
          </span>
        </div>
      )}

      {loading && !plan ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !plan || plan.programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay mesociclos que mostrar.</p>
      ) : (
        <>
          {/* Filtros: una sola fila encima de todo */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border p-3">
            <Segmented options={GRANULARITIES} value={granularity} onChange={setGranularity} />
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">Mesociclos</span>
              {plan.programs.map((p, i) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={selected.includes(p.id) ? 'default' : 'outline'}
                  title={p.title}
                  onClick={() => toggleMeso(p.id)}
                >
                  {mesoLabel(p, i)}
                </Button>
              ))}
              {selected.length < plan.programs.length && (
                <Button size="sm" variant="ghost" onClick={() => setSelected(plan.programs.map(p => p.id))}>
                  Todos
                </Button>
              )}
            </div>
            <Segmented options={SETS_MODES} value={setsMode} onChange={setSetsMode} />
          </div>

          {/* KPIs de los mesociclos seleccionados */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Series planificadas" value={round1(kpis.totalSets)} detail={`${kpis.sessions} sesiones`} />
            <StatTile label="Pico semanal de series" value={round1(kpis.peak?.totalSets)} detail={kpis.peak ? bucketLabel(kpis.peak) : undefined} />
            <StatTile label="Media de series / semana" value={round1(kpis.weeks ? kpis.totalSets / kpis.weeks : null)} />
            <StatTile label="Semanas" value={String(kpis.weeks)} detail={kpis.deload ? `${kpis.deload} de descarga` : 'sin descargas marcadas'} />
            <StatTile label="RIR medio" value={round1(kpis.rir)} detail={kpis.rpe != null ? `RPE medio ${round1(kpis.rpe)}` : undefined} />
            <StatTile label="Reps medias" value={round1(kpis.reps)} detail="ponderadas por series" />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Series totales{granularity === 'week' ? ' por semana' : ' por semana (media)'}</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart
                  label="Series / semana"
                  granularity={granularity}
                  data={buckets.map(b => ({ label: bucketLabel(b), value: b.setsPerWeek, hint: b.isDeload ? 'descarga' : undefined }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">
                  {setsLabel} de un grupo muscular{perWeekNote}
                </CardTitle>
                <select
                  className="h-8 rounded-md border bg-transparent px-2 text-sm"
                  value={activeMuscle}
                  onChange={e => setMuscle(e.target.value)}
                  aria-label="Grupo muscular"
                >
                  {muscles.map(m => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </CardHeader>
              <CardContent>
                <TrendChart
                  label={activeMuscle}
                  granularity={granularity}
                  data={buckets.map(b => ({ label: bucketLabel(b), value: muscleSetsPerWeek(b, activeMuscle, setsMode) }))}
                  references={[
                    ...(activeRef?.mev != null ? [{ y: activeRef.mev, label: `MEV ${activeRef.mev}` }] : []),
                    ...(activeRef?.mrv != null ? [{ y: activeRef.mrv, label: `MRV ${activeRef.mrv}` }] : []),
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          {/* Series por grupo muscular vs MEV/MRV */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">
                {setsLabel} por grupo muscular{perWeekNote}
              </CardTitle>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {Object.values(STATUS).map(s => (
                  <span key={s.label} className="inline-flex items-center gap-1">
                    <s.Icon className="size-3.5" style={{ color: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">Grupo muscular</TableHead>
                    {buckets.map(b => (
                      <TableHead key={b.key} className="text-right! whitespace-nowrap">
                        {bucketLabel(b)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right!">MEV</TableHead>
                    <TableHead className="text-right!">MRV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {muscles.map(m => {
                    const ref = references[m]
                    return (
                      <TableRow key={m}>
                        <TableCell className="sticky left-0 bg-background font-medium whitespace-nowrap">{m}</TableCell>
                        {buckets.map(b => {
                          const v = muscleSetsPerWeek(b, m, setsMode)
                          const status = v > 0 ? rangeStatus(v, ref) : null
                          const S = status ? STATUS[status] : null
                          return (
                            <TableCell key={b.key} className="text-right tabular-nums whitespace-nowrap" title={S ? S.label : undefined}>
                              <span className="inline-flex items-center gap-1">
                                {S && <S.Icon className="size-3.5" style={{ color: S.color }} aria-label={S.label} />}
                                {v > 0 ? round1(v) : <span className="text-muted-foreground">—</span>}
                              </span>
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right tabular-nums text-muted-foreground">{ref?.mev != null ? `≥${ref.mev}` : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{ref?.mrv != null ? `≤${ref.mrv}` : '—'}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">RIR medio planificado</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart label="RIR" granularity={granularity} data={buckets.map(b => ({ label: bucketLabel(b), value: statAvg(b.rir) }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">RPE medio planificado</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart label="RPE" granularity={granularity} data={buckets.map(b => ({ label: bucketLabel(b), value: statAvg(b.rpe) }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Repeticiones medias</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart label="Reps" granularity={granularity} data={buckets.map(b => ({ label: bucketLabel(b), value: statAvg(b.reps) }))} />
              </CardContent>
            </Card>
          </div>

          {/* Indicaciones de carga */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Indicaciones de carga (nº de ejercicios)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cuántos ejercicios llevan «Subir», «Mantener», «Bajar» o una carga fija en kg/%.
                {noSin > 0 && ` Otros ${noSin} no llevan indicación de carga.`}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={CARGA_CONFIG} className="h-[260px]! w-full">
                <BarChart
                  data={buckets.map(b => ({ label: bucketLabel(b), ...b.carga }))}
                  margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.3 }} content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {(['bajar', 'mantener', 'subir', 'fija'] as const).map((k, i, arr) => (
                    <Bar
                      key={k}
                      dataKey={k}
                      stackId="carga"
                      fill={`var(--color-${k})`}
                      stroke="var(--background)"
                      strokeWidth={2}
                      maxBarSize={56}
                      radius={i === arr.length - 1 ? [4, 4, 0, 0] : 0}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Resumen en tabla (vista accesible de todas las gráficas) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{granularity === 'week' ? 'Semana' : granularity === 'meso' ? 'Mesociclo' : 'Periodo'}</TableHead>
                    <TableHead className="text-right!">Semanas</TableHead>
                    <TableHead className="text-right!">Sesiones</TableHead>
                    <TableHead className="text-right!">Ejercicios</TableHead>
                    <TableHead className="text-right!">Series</TableHead>
                    <TableHead className="text-right!">Series/sem.</TableHead>
                    <TableHead className="text-right!">RIR (mín–máx)</TableHead>
                    <TableHead className="text-right!">RPE (mín–máx)</TableHead>
                    <TableHead className="text-right!">Reps</TableHead>
                    <TableHead className="text-right!">Subir / Mant. / Bajar / Fija</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buckets.map(b => (
                    <TableRow key={b.key}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {b.label}
                        {b.deloadWeeks > 0 && (
                          <Badge variant="outline" className="ml-2">
                            {granularity === 'week' ? 'Descarga' : `${b.deloadWeeks} desc.`}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{b.weeks}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.sessions}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.exercises}</TableCell>
                      <TableCell className="text-right tabular-nums">{round1(b.totalSets)}</TableCell>
                      <TableCell className="text-right tabular-nums">{round1(b.setsPerWeek)}</TableCell>
                      {(['rir', 'rpe'] as const).map(k => (
                        <TableCell key={k} className="text-right tabular-nums whitespace-nowrap">
                          {b[k] ? (
                            <Fragment>
                              {round1(statAvg(b[k]))} <span className="text-muted-foreground">({round1(b[k]!.min)}–{round1(b[k]!.max)})</span>
                            </Fragment>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">{round1(statAvg(b.reps))}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">
                        {b.carga.subir} / {b.carga.mantener} / {b.carga.bajar} / {b.carga.fija}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={refsOpen} onOpenChange={setRefsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Referencias MEV / MRV (series por semana)</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se aplican a todos los macrociclos. Deja un valor vacío para no usar esa referencia.
          </p>
          <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Grupo muscular</span>
            <span className="text-xs text-muted-foreground">MEV ≥</span>
            <span className="text-xs text-muted-foreground">MRV ≤</span>
            {Object.entries(refsDraft).map(([n, r]) => (
              <Fragment key={n}>
                <span>{n}</span>
                <Input
                  type="number"
                  min={0}
                  value={r.mev}
                  aria-label={`MEV ${n}`}
                  onChange={e => setRefsDraft(d => ({ ...d, [n]: { ...d[n], mev: e.target.value } }))}
                />
                <Input
                  type="number"
                  min={0}
                  value={r.mrv}
                  aria-label={`MRV ${n}`}
                  onChange={e => setRefsDraft(d => ({ ...d, [n]: { ...d[n], mrv: e.target.value } }))}
                />
              </Fragment>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRefsOpen(false)} disabled={savingRefs}>
              Cancelar
            </Button>
            <Button onClick={saveRefs} disabled={savingRefs}>
              {savingRefs ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
