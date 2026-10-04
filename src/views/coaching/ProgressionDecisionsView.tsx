import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ThumbsUp, ThumbsDown, HelpCircle, Undo2, MessageSquareQuote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { CoachOption } from '@/lib/coachExceptions'
import { ACTION_TYPE_LABELS, type ActionTypeVal } from './ProgressionRulesView'

// Decisiones del motor -- histórico de TODO lo que el Motor de Auto-Regulación
// de Carga decidió (aplicado automáticamente, pendiente de aprobación o
// rechazado), incluyendo lo que nunca pasó por el Panel de Excepciones.
// Consume /admin/next-session-targets. Patrón visual/código calcado de
// ProgressionRulesView.tsx/ExerciseSubstitutionsView.tsx (selector de coach,
// fetch de apoyo de clientes/ejercicios, lista de filas).
//
// 2026-10-04, dos cosas que dejan de hacerla de solo lectura:
//  - Cada decisión muestra LO QUE ESCRIBIÓ EL CLIENTE en ese ejercicio y en esa
//    sesión. Sin eso no hay forma de juzgar si la decisión fue buena: los
//    números no dicen «no tenía la máquina» ni «podría haberle metido más».
//  - El coach la puntúa (buena / mala / dudosa) con un comentario. Eso se
//    guarda con una foto de la decisión juzgada y es el material con el que
//    luego se decide qué regla hay que tocar -- no hay ningún aprendizaje
//    automático detrás, y es a propósito.

type PickOption = { id: number; label: string }

const ALL = '__all__'

type TargetStatus = 'aplicado' | 'pendiente' | 'rechazado'

type Verdict = 'buena' | 'mala' | 'dudosa'

type DecisionReview = {
  id: number
  verdict: Verdict
  comment: string | null
  reviewer: { id: number; first_name?: string | null; last_name?: string | null } | null
  created_at: string
}

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
    rir_delta_serie_top: number | null
    completion_ratio: number | null
    peor_serie_rir: number | null
    carga_efectiva: number | null
    carga_efectiva_reps: number | null
    tendencia_rir: number | null
    e1rm_estimado: number | null
    nota_categoria: string | null
    nota_categoria_label: string | null
  } | null
  client_note: { exercise: string | null; session: string | null } | null
  decision_review: DecisionReview | null
}

const VERDICT_META: Record<Verdict, { label: string; icon: typeof ThumbsUp; className: string }> = {
  buena:  { label: 'Buena',  icon: ThumbsUp,   className: 'text-emerald-600' },
  mala:   { label: 'Mala',   icon: ThumbsDown, className: 'text-destructive' },
  dudosa: { label: 'Dudosa', icon: HelpCircle, className: 'text-amber-600' },
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
  if (m.peor_serie_rir != null) {
    parts.push(`Peor serie: RIR ${m.peor_serie_rir}${m.peor_serie_rir <= 0 ? ' (llegó al fallo)' : ''}`)
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
  const [verdictFilter, setVerdictFilter] = useState(ALL)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const [items, setItems] = useState<TargetItem[]>([])
  const [loading, setLoading] = useState(false)

  // Comentario que el coach está escribiendo, por fila. Vive aparte de `items`
  // para no reescribir la lista entera en cada tecla.
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<number | null>(null)

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
      if (verdictFilter !== ALL) params.set('verdict', verdictFilter)
      if (fromDate.trim() !== '') params.set('from', fromDate)
      if (toDate.trim() !== '') params.set('to', toDate)
      const res = await api.get(`/admin/next-session-targets?${params.toString()}`)
      setItems(res.data?.data || res.data || [])
    } catch {
      toast.error('Error al cargar las decisiones del motor')
    } finally {
      setLoading(false)
    }
  }, [coachId, clientFilter, exerciseFilter, verdictFilter, fromDate, toDate])

  useEffect(() => { fetchDecisions() }, [fetchDecisions])

  // Puntuar una decisión. Se refresca la fila en sitio en vez de recargar la
  // lista: con el filtro «sin revisar» puesto, recargar la haría desaparecer de
  // golpe antes de que se vea que se ha guardado.
  const judge = useCallback(async (item: TargetItem, verdict: Verdict) => {
    setSaving(item.id)
    try {
      const res = await api.post(`/admin/next-session-targets/${item.id}/review`, {
        verdict,
        comment: drafts[item.id]?.trim() || null,
      })
      const review: DecisionReview = res.data?.data || res.data
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, decision_review: review } : i)))
      setDrafts(prev => { const next = { ...prev }; delete next[item.id]; return next })
      toast.success('Decisión puntuada')
    } catch {
      toast.error('No se pudo guardar la puntuación')
    } finally {
      setSaving(null)
    }
  }, [drafts])

  const undoJudgement = useCallback(async (item: TargetItem) => {
    setSaving(item.id)
    try {
      await api.delete(`/admin/next-session-targets/${item.id}/review`)
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, decision_review: null } : i)))
    } catch {
      toast.error('No se pudo retirar la puntuación')
    } finally {
      setSaving(null)
    }
  }, [])

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between flex-wrap gap-3'>
          <div>
            <CardTitle>Decisiones del motor</CardTitle>
            <CardDescription>
              Histórico completo de lo que el Motor de Auto-Regulación de Carga decidió para cada cliente/ejercicio
              — aplicado automáticamente, pendiente de aprobación o rechazado. Cada decisión viene con lo que
              escribió el cliente y se puede puntuar: lo puntuado es el material con el que después se afinan las reglas.
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
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
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
              <FieldLabel className='text-xs'>Revisión</FieldLabel>
              <Select value={verdictFilter} onValueChange={v => setVerdictFilter(v ?? ALL)}>
                <SelectTrigger><SelectValue placeholder='Todas' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  <SelectItem value='sin_revisar'>Sin revisar</SelectItem>
                  <SelectItem value='buena'>Buenas</SelectItem>
                  <SelectItem value='mala'>Malas</SelectItem>
                  <SelectItem value='dudosa'>Dudosas</SelectItem>
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
                const review = item.decision_review
                const note = item.client_note
                return (
                  <div key={item.id} className='rounded-lg border p-3.5'>
                    <div className='flex items-start justify-between gap-3 flex-wrap'>
                      <div className='min-w-0'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <p className='text-sm font-medium'>{clientDisplayName(item.client)}</p>
                          <span className='text-xs text-muted-foreground'>—</span>
                          <p className='text-sm'>{item.exercise?.title || `Ejercicio #${item.exercise_id}`}</p>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {item.metrics?.nota_categoria_label && (
                            <Badge variant='outline'>{item.metrics.nota_categoria_label}</Badge>
                          )}
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

                    {/* Lo que escribió el cliente: el contexto que los números
                        de la sesión no cuentan. */}
                    {(note?.exercise || note?.session) && (
                      <div className='mt-2.5 rounded-md bg-muted/50 p-2.5 space-y-1'>
                        {note.exercise && (
                          <p className='text-xs flex gap-1.5'>
                            <MessageSquareQuote className='size-3.5 shrink-0 mt-0.5 text-muted-foreground' />
                            <span><span className='text-muted-foreground'>En el ejercicio: </span>«{note.exercise}»</span>
                          </p>
                        )}
                        {note.session && (
                          <p className='text-xs flex gap-1.5'>
                            <MessageSquareQuote className='size-3.5 shrink-0 mt-0.5 text-muted-foreground' />
                            <span><span className='text-muted-foreground'>En la sesión: </span>«{note.session}»</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* El veredicto del coach. */}
                    <div className='mt-2.5 border-t pt-2.5'>
                      {review ? (
                        <div className='flex items-start justify-between gap-3 flex-wrap'>
                          <div className='min-w-0 text-xs'>
                            <span className={cn('font-medium', VERDICT_META[review.verdict].className)}>
                              {VERDICT_META[review.verdict].label}
                            </span>
                            {review.reviewer && <span className='text-muted-foreground'> · {resolvedByName(review.reviewer)}</span>}
                            {review.comment && <p className='text-muted-foreground mt-0.5'>{review.comment}</p>}
                          </div>
                          <Button variant='ghost' size='sm' disabled={saving === item.id} onClick={() => undoJudgement(item)}>
                            <Undo2 className='size-3.5 mr-1' /> Cambiar
                          </Button>
                        </div>
                      ) : (
                        <div className='space-y-2'>
                          <Textarea
                            className='min-h-16 text-xs'
                            placeholder='Por qué fue buena o mala (opcional, pero es lo que servirá para afinar la regla)'
                            value={drafts[item.id] ?? ''}
                            onChange={e => setDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                          <div className='flex gap-2 flex-wrap'>
                            {(Object.keys(VERDICT_META) as Verdict[]).map(v => {
                              const Icon = VERDICT_META[v].icon
                              return (
                                <Button
                                  key={v}
                                  variant='outline'
                                  size='sm'
                                  disabled={saving === item.id}
                                  onClick={() => judge(item, v)}
                                >
                                  <Icon className={cn('size-3.5 mr-1', VERDICT_META[v].className)} />
                                  {VERDICT_META[v].label}
                                </Button>
                              )
                            })}
                          </div>
                        </div>
                      )}
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
