import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, ApiError } from '@/lib/api'
import { type MonitoringResponse, type ScreenRow, type SentryIssue, share, timeAgo } from '@/lib/appMonitoring'

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; res: MonitoringResponse<T> }

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.status === 403) return 'Solo los administradores pueden ver esta sección.'
  if (e instanceof ApiError && e.data?.message) return e.data.message
  return fallback
}

function useMonitoring<T>(endpoint: string, fallback: string) {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' })
  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const res = await api.get<MonitoringResponse<T>>(endpoint)
      setState({ status: 'ok', res })
    } catch (e) {
      setState({ status: 'error', message: errorMessage(e, fallback) })
    }
  }, [endpoint, fallback])
  useEffect(() => { load() }, [load])
  return { state, reload: load }
}

function NotConfigured({ vars }: { vars: string[] }) {
  return (
    <div className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
      Falta configurar el servidor. Añade en el <code>.env</code> del backend:{' '}
      {vars.map((v, i) => <span key={v}>{i > 0 && ', '}<code className='text-foreground'>{v}</code></span>)}.
    </div>
  )
}

function Spinner() {
  return <div className='flex justify-center py-8'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
}

const LEVEL_VARIANT: Record<string, 'destructive' | 'secondary' | 'outline'> = { fatal: 'destructive', error: 'destructive', warning: 'secondary' }

function ErrorsCard() {
  const [period, setPeriod] = useState<'24h' | '14d'>('24h')
  const { state, reload } = useMonitoring<SentryIssue>(`/admin/app-monitoring/errors?period=${period}`, 'No se pudieron cargar los errores')

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between flex-wrap gap-3'>
        <div>
          <CardTitle>Errores de la app</CardTitle>
          <CardDescription>Errores sin resolver en Sentry, los más frecuentes primero.</CardDescription>
        </div>
        <div className='flex items-center gap-2'>
          <Tabs value={period} onValueChange={v => setPeriod((v as '24h' | '14d') ?? '24h')}>
            <TabsList>
              <TabsTrigger value='24h'>Últimas 24 h</TabsTrigger>
              <TabsTrigger value='14d'>Últimos 14 días</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant='outline' size='icon' onClick={reload} aria-label='Recargar'><RefreshCw className='h-4 w-4' /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {state.status === 'loading' && <Spinner />}
        {state.status === 'error' && <p className='text-sm text-destructive'>{state.message}</p>}
        {state.status === 'ok' && !state.res.configured && <NotConfigured vars={['SENTRY_API_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']} />}
        {state.status === 'ok' && state.res.configured && (
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Error</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead className='text-right'>Veces</TableHead>
                  <TableHead className='text-right'>Usuarios</TableHead>
                  <TableHead>Última vez</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.res.data.length ? state.res.data.map(issue => (
                  <TableRow key={issue.id}>
                    <TableCell className='max-w-md'>
                      <div className='font-medium text-sm truncate' title={issue.title}>{issue.title}</div>
                      <div className='text-xs text-muted-foreground truncate'>{issue.short_id}{issue.culprit ? ` · ${issue.culprit}` : ''}</div>
                    </TableCell>
                    <TableCell><Badge variant={LEVEL_VARIANT[issue.level ?? ''] ?? 'outline'}>{issue.level ?? '—'}</Badge></TableCell>
                    <TableCell className='text-right tabular-nums'>{issue.count.toLocaleString('es-ES')}</TableCell>
                    <TableCell className='text-right tabular-nums'>{issue.user_count.toLocaleString('es-ES')}</TableCell>
                    <TableCell className='text-xs text-muted-foreground whitespace-nowrap'>{timeAgo(issue.last_seen)}</TableCell>
                    <TableCell>
                      {issue.permalink && (
                        <a href={issue.permalink} target='_blank' rel='noreferrer' className='text-muted-foreground hover:text-foreground' aria-label='Abrir en Sentry'>
                          <ExternalLink className='h-4 w-4' />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={6} className='h-24 text-center'>Sin errores pendientes en este periodo.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const DAY_OPTIONS = [
  { value: '1', label: 'Hoy' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
]

function ScreensCard() {
  const [days, setDays] = useState('7')
  const { state, reload } = useMonitoring<ScreenRow>(`/admin/app-monitoring/screens?days=${days}`, 'No se pudieron cargar las pantallas')
  const total = state.status === 'ok' ? state.res.total_views ?? 0 : 0
  const max = state.status === 'ok' ? Math.max(1, ...state.res.data.map(r => r.views)) : 1

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between flex-wrap gap-3'>
        <div>
          <CardTitle>Pantallas más usadas</CardTitle>
          <CardDescription>Visitas a cada pantalla de la app según PostHog.</CardDescription>
        </div>
        <div className='flex items-center gap-2'>
          <Tabs value={days} onValueChange={v => setDays((v as string) ?? '7')}>
            <TabsList>
              {DAY_OPTIONS.map(o => <TabsTrigger key={o.value} value={o.value}>{o.label}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <Button variant='outline' size='icon' onClick={reload} aria-label='Recargar'><RefreshCw className='h-4 w-4' /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {state.status === 'loading' && <Spinner />}
        {state.status === 'error' && <p className='text-sm text-destructive'>{state.message}</p>}
        {state.status === 'ok' && !state.res.configured && <NotConfigured vars={['POSTHOG_PERSONAL_API_KEY', 'POSTHOG_PROJECT_ID', 'POSTHOG_API_HOST']} />}
        {state.status === 'ok' && state.res.configured && (
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-10'>#</TableHead>
                  <TableHead>Pantalla</TableHead>
                  <TableHead className='text-right'>Visitas</TableHead>
                  <TableHead className='text-right'>Usuarios</TableHead>
                  <TableHead className='text-right'>% del total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.res.data.length ? state.res.data.map((row, i) => (
                  <TableRow key={row.screen}>
                    <TableCell className='text-muted-foreground tabular-nums'>{i + 1}</TableCell>
                    <TableCell>
                      <div className='text-sm font-medium'>{row.screen}</div>
                      <div className='mt-1 h-1.5 rounded-full bg-muted'>
                        <div className='h-1.5 rounded-full bg-primary' style={{ width: `${(row.views / max) * 100}%` }} />
                      </div>
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>{row.views.toLocaleString('es-ES')}</TableCell>
                    <TableCell className='text-right tabular-nums'>{row.users.toLocaleString('es-ES')}</TableCell>
                    <TableCell className='text-right tabular-nums text-muted-foreground'>{share(row.views, total).toLocaleString('es-ES')} %</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className='h-24 text-center'>Sin visitas a pantallas en este periodo.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AppMonitoringView() {
  return (
    <div className='space-y-6'>
      <ErrorsCard />
      <ScreensCard />
    </div>
  )
}
