import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FootprintsIcon, GaugeIcon, TimerIcon, TrophyIcon, RefreshCwIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatDuration, formatPace } from '@/lib/blockKinds'
import {
  benchmarkLabel,
  benchmarkScoreKind,
  benchmarkTitle,
  benchmarkValue,
  hasConditioningData,
  normalizeConditioningStats,
  type ConditioningStats,
} from '@/lib/conditioningStats'

const WEEK_OPTIONS = [4, 8, 12, 26]
const KM_COLOR = '#2563eb'
const MIN_COLOR = '#16a34a'
const BENCH_COLOR = '#8b5cf6'

const shortDate = (v: unknown) => new Date(String(v)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
const fmtNumber = (n: number, digits = 1) => n.toLocaleString('es-ES', { maximumFractionDigits: digits })

function StatTile({ icon: Icon, label, value, hint }: { icon: typeof TimerIcon; label: string; value: string; hint?: string }) {
  return (
    <div className='rounded-xl border p-3'>
      <div className='flex items-center gap-1.5 text-xs text-muted-foreground'><Icon className='size-3.5' /> {label}</div>
      <div className='mt-1 text-xl font-semibold tabular-nums'>{value}</div>
      {hint && <div className='text-[11px] text-muted-foreground'>{hint}</div>}
    </div>
  )
}

/**
 * Pestaña «Acondicionamiento» de la ficha del cliente: km por semana, ritmo
 * medio, minutos de acondicionamiento e historial por benchmark. Si el
 * endpoint aún no existe (404) o no hay resultados, muestra un estado vacío.
 */
export default function ConditioningStatsPanel({ clientId }: { clientId: number | string }) {
  const [weeks, setWeeks] = useState(8)
  const [stats, setStats] = useState<ConditioningStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'unavailable' | 'failed' | null>(null)
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/admin/clients/${clientId}/conditioning-stats?weeks=${weeks}`)
      setStats(normalizeConditioningStats(res))
    } catch (err) {
      setStats(null)
      setError(err instanceof ApiError && (err.status === 404 || err.status === 405) ? 'unavailable' : 'failed')
    } finally {
      setLoading(false)
    }
  }, [clientId, weeks])

  useEffect(() => { fetchStats() }, [fetchStats])

  const benchmarkKeys = useMemo(() => Object.keys(stats?.benchmarks ?? {}).sort(), [stats])
  const activeBenchmark = selectedBenchmark && benchmarkKeys.includes(selectedBenchmark) ? selectedBenchmark : benchmarkKeys[0] ?? null
  const benchmarkEntries = useMemo(() => (activeBenchmark ? stats?.benchmarks[activeBenchmark] ?? [] : []), [stats, activeBenchmark])
  const scoreKind = benchmarkScoreKind(benchmarkEntries)
  const benchmarkData = useMemo(
    () => benchmarkEntries
      .map(e => ({ date: e.performed_date, value: benchmarkValue(e, scoreKind), label: benchmarkLabel(e) }))
      .filter(p => p.value !== null),
    [benchmarkEntries, scoreKind]
  )
  const best = useMemo(() => {
    if (!benchmarkData.length) return null
    const values = benchmarkData.map(p => p.value as number)
    const target = scoreKind === 'time' ? Math.min(...values) : Math.max(...values)
    return benchmarkData.find(p => p.value === target) ?? null
  }, [benchmarkData, scoreKind])

  const header = (
    <CardHeader className='flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between'>
      <CardTitle className='text-base flex items-center gap-2'><TimerIcon className='size-4' /> Acondicionamiento</CardTitle>
      <div className='flex items-center gap-1'>
        {WEEK_OPTIONS.map(w => (
          <button
            key={w}
            type='button'
            onClick={() => setWeeks(w)}
            className={cn('rounded-full border px-2.5 py-0.5 text-xs transition-colors', weeks === w ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}
          >
            {w} sem
          </button>
        ))}
      </div>
    </CardHeader>
  )

  if (loading) {
    return (
      <Card>{header}<CardContent><div className='flex justify-center py-12'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div></CardContent></Card>
    )
  }

  if (error || !hasConditioningData(stats)) {
    return (
      <Card>
        {header}
        <CardContent>
          <div className='flex flex-col items-center py-12 text-center text-muted-foreground'>
            <FootprintsIcon className='size-10 mb-3 opacity-40' />
            {error === 'failed' ? (
              <>
                <p className='text-sm'>No se pudieron cargar las estadísticas de acondicionamiento.</p>
                <Button variant='outline' size='sm' className='mt-3 gap-1' onClick={fetchStats}><RefreshCwIcon className='size-3.5' /> Reintentar</Button>
              </>
            ) : error === 'unavailable' ? (
              <p className='text-sm'>Las estadísticas de acondicionamiento todavía no están disponibles en el servidor.</p>
            ) : (
              <>
                <p className='text-sm'>Sin resultados de acondicionamiento en las últimas {weeks} semanas.</p>
                <p className='text-xs mt-1'>Aparecen cuando el cliente registra un bloque EMOM, AMRAP, For Time, Intervalos o Carrera.</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const s = stats as ConditioningStats
  const weeklyData = s.weekly_km.map(w => ({
    week: w.week_start,
    km: w.km,
    minutes: s.weekly_minutes.find(m => m.week_start === w.week_start)?.minutes ?? 0,
  }))
  // Si el backend mandara minutos sin km (o al revés), se usan las semanas de minutos.
  const chartData = weeklyData.length ? weeklyData : s.weekly_minutes.map(m => ({ week: m.week_start, km: 0, minutes: m.minutes }))
  const weeksWithKm = s.weekly_km.length || weeks

  return (
    <div className='space-y-4'>
      <Card>
        {header}
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
            <StatTile icon={FootprintsIcon} label='Km por semana' value={fmtNumber(s.total_km / Math.max(1, weeksWithKm))} hint={`${fmtNumber(s.total_km)} km en ${weeksWithKm} semanas`} />
            <StatTile icon={GaugeIcon} label='Ritmo medio' value={formatPace(s.avg_pace_sec_km) || '—'} />
            <StatTile icon={TimerIcon} label='Min. acondicionamiento' value={fmtNumber(s.conditioning_minutes, 0)} hint={`en ${weeks} semanas`} />
            <StatTile icon={TrophyIcon} label='Resultados registrados' value={String(s.results_count)} />
          </div>

          {chartData.length > 0 && (
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
              <div>
                <p className='text-xs font-medium mb-1'>Km por semana</p>
                <div className='h-[200px]'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray='3 3' className='stroke-muted' vertical={false} />
                      <XAxis dataKey='week' tick={{ fontSize: 10 }} tickFormatter={shortDate} />
                      <YAxis tick={{ fontSize: 10 }} width={36} />
                      <Tooltip labelFormatter={v => `Semana del ${shortDate(v)}`} formatter={value => [`${fmtNumber(Number(value))} km`, 'Distancia']} />
                      <Bar dataKey='km' fill={KM_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className='text-xs font-medium mb-1'>Minutos de acondicionamiento por semana</p>
                <div className='h-[200px]'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray='3 3' className='stroke-muted' vertical={false} />
                      <XAxis dataKey='week' tick={{ fontSize: 10 }} tickFormatter={shortDate} />
                      <YAxis tick={{ fontSize: 10 }} width={36} />
                      <Tooltip labelFormatter={v => `Semana del ${shortDate(v)}`} formatter={value => [`${fmtNumber(Number(value), 0)} min`, 'Acondicionamiento']} />
                      <Bar dataKey='minutes' fill={MIN_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base flex items-center gap-2'><TrophyIcon className='size-4' /> Benchmarks</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {benchmarkKeys.length === 0 ? (
            <p className='text-sm text-muted-foreground text-center py-6'>
              Sin benchmarks todavía. Pon una clave de benchmark (p. ej. <span className='font-mono'>row_1000</span>) en un bloque para comparar resultados entre sesiones.
            </p>
          ) : (
            <>
              <div className='flex gap-2 flex-wrap'>
                {benchmarkKeys.map(k => (
                  <button
                    key={k}
                    type='button'
                    onClick={() => setSelectedBenchmark(k)}
                    className={cn('px-3 py-1 text-xs rounded-full border transition-colors', activeBenchmark === k ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}
                    title={k}
                  >
                    {benchmarkTitle(k)} <span className='opacity-70'>({s.benchmarks[k].length})</span>
                  </button>
                ))}
              </div>
              {best && (
                <p className='text-xs text-muted-foreground'>
                  Mejor marca: <span className='font-medium text-foreground'>{best.label}</span> ({new Date(best.date).toLocaleDateString('es-ES')})
                  {scoreKind === 'time' && ' · menos es mejor'}
                </p>
              )}
              {benchmarkData.length > 1 && (
                <div className='h-[240px]'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <LineChart data={benchmarkData}>
                      <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                      <XAxis dataKey='date' tick={{ fontSize: 10 }} tickFormatter={shortDate} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        width={48}
                        domain={['auto', 'auto']}
                        reversed={scoreKind === 'time'}
                        tickFormatter={v => (scoreKind === 'time' ? formatDuration(Number(v)) : scoreKind === 'rounds' ? String(Math.floor(Number(v))) : `${v} m`)}
                      />
                      <Tooltip
                        labelFormatter={v => new Date(String(v)).toLocaleDateString('es-ES')}
                        formatter={(_value, _name, item) => [String((item?.payload as { label?: string } | undefined)?.label ?? ''), 'Resultado']}
                      />
                      <Line type='monotone' dataKey='value' stroke={BENCH_COLOR} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Fecha</TableHead><TableHead>Resultado</TableHead><TableHead>RPE</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {[...benchmarkEntries].reverse().map((e, i) => (
                    <TableRow key={e.id ?? `${e.performed_date}-${i}`}>
                      <TableCell className='text-xs'>{new Date(e.performed_date).toLocaleDateString('es-ES')}</TableCell>
                      <TableCell className='font-medium text-sm tabular-nums'>{benchmarkLabel(e)}</TableCell>
                      <TableCell className='text-xs'>{e.rpe ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
