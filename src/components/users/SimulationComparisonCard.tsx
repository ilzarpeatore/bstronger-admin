import { FlagIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/blockKinds'
import { benchmarkLabel, benchmarkTitle, formatDiff, type LastSimulation } from '@/lib/conditioningStats'

const SIM_TITLES: Record<string, string> = {
  hyrox_full_sim: 'Simulacro Hyrox completo',
  hyrox_half_sim_a: 'Medio simulacro (estaciones 1-4)',
  hyrox_half_sim_b: 'Medio simulacro (estaciones 5-8)',
}

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-ES') : '')

/** Color de una diferencia de tiempo: menos es mejor. */
function diffClass(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || sec === 0) return 'text-muted-foreground'
  return sec < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
}

/**
 * Último simulacro del cliente con sus parciales frente al anterior
 * (fase 2 Hyrox, 2.3/2.4): tiempo de cada carrera y estación, diferencia,
 * carrera más lenta frente a la media y estación más lenta frente a su media.
 */
export default function SimulationComparisonCard({ sim }: { sim: LastSimulation }) {
  const a = sim.analysis
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base flex items-center gap-2'>
          <FlagIcon className='size-4' /> {SIM_TITLES[sim.benchmark_key] ?? benchmarkTitle(sim.benchmark_key)}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm'>
          <span>
            Último: <span className='font-semibold tabular-nums'>{benchmarkLabel(sim.current)}</span>{' '}
            <span className='text-xs text-muted-foreground'>({fmtDate(sim.current.performed_date)})</span>
          </span>
          {sim.previous ? (
            <span className='text-muted-foreground'>
              Anterior: <span className='tabular-nums'>{benchmarkLabel(sim.previous)}</span> ({fmtDate(sim.previous.performed_date)})
              {sim.total_diff_sec !== null && <span className={cn('ml-2 font-semibold tabular-nums', diffClass(sim.total_diff_sec))}>{formatDiff(sim.total_diff_sec)}</span>}
            </span>
          ) : (
            <span className='text-xs text-muted-foreground'>Primer simulacro registrado: no hay otro con el que comparar.</span>
          )}
        </div>

        {a && (a.runs || a.slowest_station) && (
          <div className='grid gap-2 sm:grid-cols-2'>
            {a.runs && (
              <div className='rounded-lg border p-2.5 text-xs'>
                <p className='font-medium text-sm'>Carreras</p>
                <p className='text-muted-foreground'>
                  Media {formatDuration(a.runs.avg_t_sec)} por tramo ({a.runs.count}). Más lenta: la nº {a.runs.slowest.position} con{' '}
                  {formatDuration(a.runs.slowest.t_sec)} ({formatDiff(a.runs.slowest.diff_vs_avg_sec)} sobre la media).
                </p>
              </div>
            )}
            {a.slowest_station && (
              <div className='rounded-lg border p-2.5 text-xs'>
                <p className='font-medium text-sm'>Estación a trabajar</p>
                <p className='text-muted-foreground'>
                  {a.slowest_station.label}: {formatDuration(a.slowest_station.t_sec)}
                  {a.slowest_station.basis === 'media_propia' && a.slowest_station.avg_t_sec !== null
                    ? ` frente a su media de ${formatDuration(a.slowest_station.avg_t_sec)} (${formatDiff(a.slowest_station.diff_vs_avg_sec)}).`
                    : ' (la estación más larga; con más simulacros se compara con su media).'}
                </p>
              </div>
            )}
          </div>
        )}

        {sim.splits.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-8'>#</TableHead>
                <TableHead>Paso</TableHead>
                <TableHead className='text-right'>Tiempo</TableHead>
                <TableHead className='text-right'>Anterior</TableHead>
                <TableHead className='text-right'>Dif.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sim.splits.map(s => (
                <TableRow key={s.index} className={cn(s.is_run && 'bg-muted/40')}>
                  <TableCell className='text-xs text-muted-foreground'>{s.index + 1}</TableCell>
                  <TableCell className='text-sm'>{s.label}</TableCell>
                  <TableCell className='text-right tabular-nums text-sm'>{s.t_sec !== null ? formatDuration(s.t_sec) : '—'}</TableCell>
                  <TableCell className='text-right tabular-nums text-xs text-muted-foreground'>{s.previous_t_sec !== null ? formatDuration(s.previous_t_sec) : '—'}</TableCell>
                  <TableCell className={cn('text-right tabular-nums text-xs font-medium', diffClass(s.diff_sec))}>{formatDiff(s.diff_sec) || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
