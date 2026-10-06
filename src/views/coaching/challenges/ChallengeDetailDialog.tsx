import { useCallback, useEffect, useMemo, useState } from 'react'
import { BanIcon, FlagIcon, MoreHorizontalIcon, PencilIcon, RotateCcwIcon, UserMinusIcon, UserPlusIcon, XCircleIcon } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { api } from '@/lib/api'
import ClientPicker from './ClientPicker'
import {
  PARTICIPANT_STATUS_LABEL,
  STATUS_LABEL,
  buildEvolution,
  canInvite,
  formatValue,
  isCancellable,
  isEditable,
  isFinalizable,
  participantLabel,
  progressPct,
  sortParticipants,
  type ChallengeDetail,
  type ChallengeMetric,
  type ChallengeParticipant,
  type ClientOption,
} from './challengeForm'

// Paleta categórica de referencia (dataviz), igual que MacrocycleDashboardView.
const CATEGORICAL = [
  { light: '#2a78d6', dark: '#3987e5' },
  { light: '#eb6834', dark: '#d95926' },
  { light: '#1baf7a', dark: '#199e70' },
  { light: '#eda100', dark: '#c98500' },
  { light: '#e87ba4', dark: '#d55181' },
]

type Confirm =
  | { kind: 'cancel' }
  | { kind: 'finalize' }
  | { kind: 'remove'; p: ChallengeParticipant }
  | { kind: 'exclude'; p: ChallengeParticipant }
  | { kind: 'reset-alias'; p: ChallengeParticipant }

type Props = {
  challengeId: number | null
  onClose: () => void
  metrics: ChallengeMetric[]
  onEdit: (detail: ChallengeDetail) => void
  /** Algo cambió (estado, participantes): la lista debe recargarse. */
  onChanged: () => void
}

const errMsg = (err: unknown, fallback: string) => {
  const e = err as { message?: string; data?: { errors?: Record<string, string[]> } }
  return (e?.data?.errors ? Object.values(e.data.errors)[0]?.[0] : undefined) || e?.message || fallback
}

const ChallengeDetailDialog = ({ challengeId, onClose, metrics, onEdit, onChanged }: Props) => {
  const [detail, setDetail] = useState<ChallengeDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [invites, setInvites] = useState<ClientOption[]>([])

  const load = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/challenge-detail/${id}`)
      setDetail(res?.data ?? null)
    } catch {
      toast.error('Error al cargar el reto')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setDetail(null)
    setInviting(false)
    setInvites([])
    if (challengeId) load(challengeId)
  }, [challengeId, load])

  const metric = useMemo(() => metrics.find(m => m.key === detail?.metric_key), [metrics, detail])
  const unit = detail?.unit ?? metric?.unit ?? null
  const participants = useMemo(() => sortParticipants(detail?.participants ?? []), [detail])
  const joined = participants.filter(p => p.status === 'joined')
  const invited = participants.filter(p => p.status === 'invited')
  const reached = joined.filter(p => p.threshold_reached).length

  const evolution = useMemo(() => buildEvolution(detail?.snapshots, detail?.participants ?? [], 5), [detail])
  const chartConfig = useMemo(() => {
    const cfg: ChartConfig = {}
    evolution.series.forEach((p, i) => {
      cfg[`c${p.client_id}`] = { label: participantLabel(p), theme: CATEGORICAL[i % CATEGORICAL.length] }
    })
    return cfg
  }, [evolution])

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string): Promise<boolean> => {
    if (!detail) return false
    setBusy(true)
    try {
      await fn()
      toast.success(ok)
      setConfirm(null)
      setReason('')
      await load(detail.id)
      onChanged()
      return true
    } catch (err) {
      toast.error(errMsg(err, fail))
      return false
    } finally {
      setBusy(false)
    }
  }

  const doConfirm = () => {
    if (!detail || !confirm) return
    const id = detail.id
    switch (confirm.kind) {
      case 'cancel':
        return run(() => api.post(`/admin/challenge-cancel/${id}`, {}), 'Reto cancelado', 'No se pudo cancelar')
      case 'finalize':
        return run(() => api.post(`/admin/challenge-finalize/${id}`, {}), 'Reto finalizado y resultados anunciados', 'No se pudo finalizar')
      case 'remove':
        return run(() => api.post(`/admin/challenge-remove-participant/${id}`, { client_id: confirm.p.client_id }), 'Participante quitado', 'No se pudo quitar')
      case 'exclude':
        if (!reason.trim()) { toast.error('Indica el motivo'); return }
        return run(() => api.post(`/admin/challenge-exclude-participant/${id}`, { client_id: confirm.p.client_id, reason: reason.trim() }), 'Participante excluido', 'No se pudo excluir')
      case 'reset-alias':
        return run(() => api.post('/admin/challenge-reset-alias', { client_id: confirm.p.client_id }), 'Alias reseteado', 'No se pudo resetear el alias')
    }
  }

  const sendInvites = async () => {
    if (!detail || !invites.length) return
    const ok = await run(() => api.post(`/admin/challenge-invite/${detail.id}`, { client_ids: invites.map(c => c.id) }), `${invites.length} invitación(es) enviada(s)`, 'No se pudieron enviar las invitaciones')
    if (ok) { setInvites([]); setInviting(false) }
  }

  const confirmCopy: Record<Confirm['kind'], { title: string; body: (p?: ChallengeParticipant) => string; action: string; destructive?: boolean }> = {
    cancel: { title: 'Cancelar reto', body: () => 'Se cancela para todos los participantes y deja de contar. No se puede deshacer.', action: 'Cancelar reto', destructive: true },
    finalize: {
      title: 'Finalizar y anunciar',
      body: () => detail?.status === 'active'
        ? 'El reto sigue activo: se calculará la puntuación ahora, se cerrará antes de tiempo y se notificará a los participantes.'
        : 'Se cierra el reto y se notifica el resultado a los participantes. Revisa antes la clasificación y excluye a quien haga falta.',
      action: 'Finalizar y anunciar',
    },
    remove: { title: 'Quitar participante', body: p => `${p ? participantLabel(p) : ''} dejará de estar en el reto.`, action: 'Quitar', destructive: true },
    exclude: { title: 'Excluir de la clasificación', body: p => `${p ? participantLabel(p) : ''} quedará fuera del ranking. El motivo queda registrado (no se muestra a otros clientes).`, action: 'Excluir', destructive: true },
    'reset-alias': { title: 'Resetear alias', body: p => `Se borra el alias «${p?.alias ?? ''}» de ${p ? participantLabel(p) : ''} en TODOS los retos; tendrá que elegir otro antes de volver a aparecer.`, action: 'Resetear alias', destructive: true },
  }

  const confirmP = confirm && 'p' in confirm ? confirm.p : undefined
  const threshold = detail?.format === 'threshold' && detail.threshold_value != null ? Number(detail.threshold_value) : null

  return (
    <>
      <Dialog open={challengeId !== null} onOpenChange={o => { if (!o) onClose() }}>
        <DialogContent className='sm:max-w-5xl'>
          <DialogHeader>
            <DialogTitle className='flex flex-wrap items-center gap-2'>
              {detail?.title ?? 'Reto'}
              {detail && <Badge variant={detail.status === 'cancelled' ? 'destructive' : 'secondary'}>{STATUS_LABEL[detail.status]}</Badge>}
              {detail && <Badge variant='outline'>{detail.visibility === 'open' ? 'Abierto' : 'Cerrado'}</Badge>}
            </DialogTitle>
            {detail && (
              <DialogDescription>
                {detail.metric_label ?? metric?.label ?? detail.metric_key} · {detail.format === 'threshold' ? `Objetivo: ${formatValue(detail.threshold_value, unit)}` : 'Ranking'} · {detail.start_date} → {detail.end_date}
                {detail.prize ? ` · Premio: ${detail.prize}` : ''}
                {detail.paid_only ? ' · Solo pago' : ''}
              </DialogDescription>
            )}
          </DialogHeader>

          {loading && !detail ? (
            <div className='flex h-40 items-center justify-center'>
              <div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            </div>
          ) : detail ? (
            <div className='flex flex-col gap-4'>
              <div className='flex flex-wrap gap-2'>
                {isEditable(detail) && <Button variant='outline' size='sm' onClick={() => onEdit(detail)}><PencilIcon className='mr-1.5 size-4' /> Editar</Button>}
                {canInvite(detail) && <Button variant='outline' size='sm' onClick={() => setInviting(v => !v)}><UserPlusIcon className='mr-1.5 size-4' /> Invitar clientes</Button>}
                {isFinalizable(detail) && <Button size='sm' onClick={() => setConfirm({ kind: 'finalize' })}><FlagIcon className='mr-1.5 size-4' /> Finalizar y anunciar</Button>}
                {isCancellable(detail) && <Button variant='destructive' size='sm' onClick={() => setConfirm({ kind: 'cancel' })}><XCircleIcon className='mr-1.5 size-4' /> Cancelar reto</Button>}
              </div>

              {inviting && (
                <div className='flex flex-col gap-2 rounded-lg border p-3'>
                  <ClientPicker selected={invites} onChange={setInvites} excludeIds={participants.filter(p => p.status !== 'declined' && p.status !== 'left').map(p => p.client_id)} />
                  <div className='flex justify-end gap-2'>
                    <Button variant='outline' size='sm' onClick={() => { setInviting(false); setInvites([]) }}>Cancelar</Button>
                    <Button size='sm' disabled={!invites.length || busy} onClick={sendInvites}>Enviar {invites.length || ''} invitación{invites.length === 1 ? '' : 'es'}</Button>
                  </div>
                </div>
              )}

              <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                {[
                  { label: 'Unidos', value: joined.length },
                  { label: 'Invitados pendientes', value: invited.length },
                  { label: detail.format === 'threshold' ? 'Han llegado al objetivo' : 'Mínimo para empezar', value: detail.format === 'threshold' ? reached : detail.min_participants ?? 3 },
                  { label: 'Clasificación visible', value: joined.length >= 3 ? 'Sí' : 'No (< 3)' },
                ].map(s => (
                  <div key={s.label} className='rounded-lg border p-3'>
                    <p className='text-xs text-muted-foreground'>{s.label}</p>
                    <p className='text-xl font-semibold tabular-nums'>{s.value}</p>
                  </div>
                ))}
              </div>

              {evolution.data.length > 1 && (
                <div className='rounded-lg border p-3'>
                  <p className='mb-2 text-sm font-medium'>Evolución (top {evolution.series.length})</p>
                  <ChartContainer config={chartConfig} className='h-[240px]! w-full'>
                    <LineChart data={evolution.data} margin={{ top: 12, right: threshold ? 56 : 12, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke='var(--border)' strokeDasharray='4 4' />
                      <XAxis dataKey='date' tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis tickLine={false} axisLine={false} width={40} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      {threshold !== null && (
                        <ReferenceLine y={threshold} stroke='var(--muted-foreground)' strokeDasharray='4 4' label={{ value: 'Objetivo', position: 'right', fontSize: 11, fill: 'var(--muted-foreground)' }} />
                      )}
                      {evolution.series.map(p => (
                        <Line key={p.client_id} dataKey={`c${p.client_id}`} type='monotone' stroke={`var(--color-c${p.client_id})`} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                      ))}
                    </LineChart>
                  </ChartContainer>
                </div>
              )}

              <div className='rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-[60px]'>Puesto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Alias</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className='text-right'>Valor</TableHead>
                      <TableHead className='w-[160px]'>Progreso</TableHead>
                      <TableHead className='w-[50px]' />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.length ? participants.map(p => {
                      const pct = progressPct(p, detail)
                      return (
                        <TableRow key={p.client_id} className={p.status === 'excluded' || p.status === 'left' || p.status === 'declined' ? 'opacity-60' : undefined}>
                          <TableCell className='tabular-nums'>{p.status === 'joined' ? p.rank ?? '—' : '—'}</TableCell>
                          <TableCell>
                            <div className='font-medium'>{participantLabel(p)}</div>
                            {p.email && <div className='text-xs text-muted-foreground'>{p.email}</div>}
                          </TableCell>
                          <TableCell>{p.alias ?? <span className='text-muted-foreground'>sin alias</span>}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === 'excluded' ? 'destructive' : p.status === 'joined' ? 'default' : 'secondary'}>{PARTICIPANT_STATUS_LABEL[p.status] ?? p.status}</Badge>
                            {p.status === 'excluded' && p.excluded_reason && <div className='mt-1 max-w-[220px] text-xs text-muted-foreground'>{p.excluded_reason}</div>}
                          </TableCell>
                          <TableCell className='text-right tabular-nums'>{formatValue(p.current_value, unit)}</TableCell>
                          <TableCell>
                            {pct !== null ? (
                              <div className='flex items-center gap-2'>
                                <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'>
                                  <div className='h-full rounded-full bg-primary' style={{ width: `${pct}%` }} />
                                </div>
                                <span className='w-9 text-right text-xs tabular-nums'>{pct}%</span>
                              </div>
                            ) : <span className='text-muted-foreground'>—</span>}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant='ghost' size='icon-sm' aria-label='Acciones' />}>
                                <MoreHorizontalIcon className='size-4' />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end'>
                                {p.status === 'joined' && (
                                  <DropdownMenuItem variant='destructive' onClick={() => { setReason(''); setConfirm({ kind: 'exclude', p }) }}><BanIcon /> Excluir con motivo</DropdownMenuItem>
                                )}
                                {(p.status === 'joined' || p.status === 'invited' || p.status === 'excluded') && (
                                  <DropdownMenuItem variant='destructive' onClick={() => setConfirm({ kind: 'remove', p })}><UserMinusIcon /> Quitar del reto</DropdownMenuItem>
                                )}
                                <DropdownMenuItem disabled={!p.alias} onClick={() => setConfirm({ kind: 'reset-alias', p })}><RotateCcwIcon /> Resetear alias</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    }) : (
                      <TableRow>
                        <TableCell colSpan={7} className='h-16 text-center text-muted-foreground'>
                          {detail.visibility === 'closed' ? 'Aún no hay invitados.' : 'Aún no se ha apuntado nadie.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className='text-xs text-muted-foreground'>Los nombres reales solo los ves tú; los clientes ven únicamente los alias.</p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant='outline' onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm !== null} onOpenChange={o => { if (!o && !busy) setConfirm(null) }}>
        <AlertDialogContent>
          {confirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmCopy[confirm.kind].title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmCopy[confirm.kind].body(confirmP)}</AlertDialogDescription>
              </AlertDialogHeader>
              {confirm.kind === 'exclude' && (
                <Textarea autoFocus rows={3} placeholder='Motivo (p. ej. sesiones sin series apuntadas)' value={reason} onChange={e => setReason(e.target.value)} />
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
                <AlertDialogAction
                  variant={confirmCopy[confirm.kind].destructive ? 'destructive' : 'default'}
                  disabled={busy || (confirm.kind === 'exclude' && !reason.trim())}
                  onClick={doConfirm}
                >
                  {busy ? 'Procesando…' : confirmCopy[confirm.kind].action}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default ChallengeDetailDialog
