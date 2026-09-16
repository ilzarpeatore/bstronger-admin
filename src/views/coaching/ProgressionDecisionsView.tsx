import { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CoachOption } from '@/lib/coachExceptions'
import { ACTION_TYPE_LABELS, type ActionTypeVal } from './ProgressionRulesView'

// Decisiones del motor -- histórico/auditoría de solo lectura de TODO lo que
// el Motor de Auto-Regulación de Carga decidió (aplicado automáticamente,
// pendiente de aprobación o rechazado), incluyendo lo que nunca pasó por el
// Panel de Excepciones. Consume /admin/next-session-targets (contrato fijado
// por el agente de backend en paralelo, ver notas de la tarea). Patrón
// visual/código calcado de ProgressionRulesView.tsx/ExerciseSubstitutionsView.tsx
// (selector de coach, fetch de apoyo de clientes/ejercicios, lista de filas).

type PickOption = { id: number; label: string }

const ALL = '__all__'

type TargetStatus = 'aplicado' | 'pendiente' | 'rechazado'

type TargetItem = {
  id: number
  client_id: number
  exercise_id: number
  workout_session_review_id: number
  proposed_weight: number | null
  proposed_reps: number | null
  proposed_exercise_id: number | null
  status: TargetStatus
  generated_at: string
  resolved_at: string | null
  client: { id: number; first_name?: string | null; last_name?: string | null; email?: string | null }
  exercise: { id: number; title: string }
  proposed_exercise: { id: number; title: string } | null
  rule: {
    id: number
    name: string
    action: { type: ActionTypeVal; value: number | null; rounding: string; base_reference: string }
  } | null
  resolved_by: { id: number; first_name?: string | null; last_name?: string | null } | null
  metrics: {
    rir_delta_sesion: number | null
    completion_ratio: number | null
    carga_efectiva: number | null
    carga_efectiva_reps: number | null
    tendencia_rir: number | null
    e1rm_estimado: number | null
  } | null
}

const STATUS_META: Record<TargetStatus, { label: string; variant: 'default' | 'outline' | 'destructive' }> = {
  aplicado: { label: 'Aplicado', variant: 'default' },
  pendiente: { label: 'Pendiente', variant: 'outline' },
  rechazado: { label: 'Rechazado', variant: 'destructive' },
}

const clientDisplayName = (c: TargetItem['client']): string =>
  `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || `Cliente #${c.id}`

const resolvedByName = (r: TargetItem['resolved_by']): string =>
  r ? (`${r.first_name || ''} ${r.last_name || ''}`.trim() || `#${r.id}`) : ''

function decisionText(item: TargetItem): string {
  const actionType = item.rule?.action?.type
  const parts: string[] = [actionType ? ACTION_TYPE_LABELS[actionType] : 'Ajuste propuesto']
  if (item.proposed_weight != null) parts.push(`${item.proposed_weight}kg`)
  if (item.proposed_reps != null) parts.push(`${item.proposed_reps} reps`)
  if (actionType === 'sustituir_ejercicio' && item.proposed_exercise) parts.push(`→ ${item.proposed_exercise.title}`)
  return parts.join(' · ')
}

function metricsText(m: TargetItem['metrics']): string {
  if (!m) return 'Sin datos de sesión disponibles para esta propuesta'
  const parts: string[] = []
  if (m.rir_delta_sesion != null) {
    const sign = m.rir_delta_sesion > 0 ? '+' : ''
    const note = m.rir_delta_sesion > 0 ? 'más fácil de lo pedido' : m.rir_delta_sesion < 0 ? 'más difícil de lo pedido' : 'igual a lo pedido'
    parts.push(`RIR real vs. pedido: ${sign}${m.rir_delta_sesion} (${note})`)
  }
  if (m.completion_ratio != null) parts.push(`Series completadas: ${Math.round(m.completion_ratio * 100)}%`)
  if (m.carga_efectiva != null) {
    parts.push(`Carga efectiva conseguida: ${m.carga_efectiva}kg${m.carga_efectiva_reps != null ? `×${m.carga_efectiva_reps}` : ''}`)
  }
  if (m.tendencia_rir != null) parts.push(`Tendencia de RIR: ${m.tendencia_rir > 0 ? '+' : ''}${m.tendencia_rir}`)
  if (m.e1rm_estimado != null) parts.push(`e1RM estimado: ${m.e1rm_estimado}kg`)
  return parts.length ? parts.join(' · ') : 'Sin datos de sesión disponibles para esta propuesta'
}

const ProgressionDecisionsView = () => {
  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [coachId, setCoachId] = useState('')

  const [clients, setClients] = useState<PickOption[]>([])
  const [exercises, setExercises] = useState<PickOption[]>([])

  const [clientFilter, setClientFilter] = useState(ALL)
  const [exerciseFilter, setExerciseFilter] = useState(ALL)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [items, setItems] = useState<TargetItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCoaches = useCallback(async () => {
    try {
      const res = await api.get('/admin/coach-exceptions/coaches')
      setCoaches(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar la lista de coaches')
    }
  }, [])

  useEffect(() => { fetchCoaches() }, [fetchCoaches])
  useEffect(() => {
    if (!coachId && coaches.length > 0) setCoachId(String(coaches[0].id))
  }, [coachId, coaches])

  // Listas de apoyo para los filtros -- mismo patrón/endpoints que
  // ProgressionRulesView.tsx.
  useEffect(() => {
    api.get('/admin/users?per_page=500').then(res => {
      const data = res.data?.data || res.data || []
      setClients(data.map((u: any) => ({ id: u.id, label: `${u.display_name || u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Cliente'} (${u.email || u.id})` })))
    }).catch(() => {})
    api.get('/admin/exercises?per_page=500').then(res => {
      const data = res.data?.data || res.data || []
      setExercises(data.map((e: any) => ({ id: e.id, label: e.title || e.name || `Ejercicio #${e.id}` })))
    }).catch(() => {})
  }, [])

  const fetchDecisions = useCallback(async () => {
    if (!coachId) { setItems([]); return }
    setLoading(true)
    try {
      const params = new URLSearchParams({ coach_id: coachId })
      if (clientFilter !== ALL) params.set('client_id', clientFilter)
      if (exerciseFilter !== ALL) params.set('exercise_id', exerciseFilter)
      if (fromDate.trim() !== '') params.set('from', fromDate)
      if (toDate.trim() !== '') params.set('to', toDate)
      const res = await api.get(`/admin/next-session-targets?${params.toString()}`)
      setItems(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar las decisiones del motor')
    } finally {
      setLoading(false)
    }
  }, [coachId, clientFilter, exerciseFilter, fromDate, toDate])

  useEffect(() => { fetchDecisions() }, [fetchDecisions])

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between flex-wrap gap-3'>
          <div>
            <CardTitle>Decisiones del motor</CardTitle>
            <CardDescription>
              Histórico completo de lo que el Motor de Auto-Regulación de Carga decidió para cada cliente/ejercicio
              — aplicado automáticamente, pendiente de aprobación o rechazado. Solo lectura.
            </CardDescription>
          </div>
          <div className='flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:items-center'>
            <Select value={coachId} onValueChange={v => setCoachId(v ?? '')}>
              <SelectTrigger className='w-full sm:w-64'><SelectValue placeholder='Seleccionar coach' /></SelectTrigger>
              <SelectContent>
                {coaches.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant='outline' size='icon' onClick={fetchDecisions} disabled={loading} title='Actualizar'>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            <Field className='gap-1.5'>
              <FieldLabel className='text-xs'>Cliente</FieldLabel>
              <Select value={clientFilter} onValueChange={v => setClientFilter(v ?? ALL)}>
                <SelectTrigger><SelectValue placeholder='Todos los clientes' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los clientes</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-1.5'>
              <FieldLabel className='text-xs'>Ejercicio</FieldLabel>
              <Select value={exerciseFilter} onValueChange={v => setExerciseFilter(v ?? ALL)}>
                <SelectTrigger><SelectValue placeholder='Todos los ejercicios' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los ejercicios</SelectItem>
                  {exercises.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field className='gap-1.5'>
              <FieldLabel className='text-xs'>Desde</FieldLabel>
              <Input type='date' value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </Field>
            <Field className='gap-1.5'>
              <FieldLabel className='text-xs'>Hasta</FieldLabel>
              <Input type='date' value={toDate} onChange={e => setToDate(e.target.value)} />
            </Field>
          </div>

          {loading ? (
            <div className='flex justify-center py-12'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
          ) : items.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-muted-foreground text-sm'>
              <p>{coachId ? 'No hay decisiones del motor para estos filtros.' : 'Selecciona un coach para ver sus decisiones.'}</p>
            </div>
          ) : (
            <div className='space-y-2.5'>
              {items.map(item => {
                const status = STATUS_META[item.status]
                return (
                  <div key={item.id} className='rounded-lg border p-3.5'>
                    <div className='flex items-start justify-between gap-3 flex-wrap'>
                      <div className='min-w-0'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <p className='text-sm font-medium'>{clientDisplayName(item.client)}</p>
                          <span className='text-xs text-muted-foreground'>—</span>
                          <p className='text-sm'>{item.exercise?.title || `Ejercicio #${item.exercise_id}`}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className='text-xs text-muted-foreground mt-1'>
                          {new Date(item.generated_at).toLocaleString()} · Decidido: {decisionText(item)}
                        </p>
                        <p className='text-xs text-muted-foreground mt-1'>{metricsText(item.metrics)}</p>
                        <p className='text-xs text-muted-foreground mt-1'>
                          Regla: {item.rule?.name || 'Sin regla (no aplica)'}
                          {item.resolved_by && <> · Resuelto por {resolvedByName(item.resolved_by)}</>}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ProgressionDecisionsView
