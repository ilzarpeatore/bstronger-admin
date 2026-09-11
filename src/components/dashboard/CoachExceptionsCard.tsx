import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, X, RefreshCw, PencilIcon, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SimpleBar from 'simplebar-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useCoachExceptions } from '@/hooks/useCoachExceptions'
import {
  CATEGORY_META,
  cardAccentClass,
  severityBadgeVariant,
  clientLabel,
  formatRelative,
  sortByUrgency,
  isSuggestionCategory,
  isAdaptiveWeekCategory,
  asSuggestionDetail,
  asAdaptiveWeekDetail,
  type ExceptionItem,
  type CoachOption,
} from '@/lib/coachExceptions'

// Tarjeta de excepciones del Motor de Auto-Regulación con acciones reales
// (docs/Plan_Cierre_Motor_UI.md, Fase 2). Un solo componente parametrizable
// para no duplicar la lógica de fetch/acciones (useCoachExceptions) ni el
// render de filas entre las 2 superficies pedidas:
//   - Dashboard general (`variant="dashboard"`, sin clientId): todos los
//     coaches/clientes, muestra de quién es cada ítem.
//   - Resumen de cliente (`variant="compact"`, con clientId): un cliente
//     fijo, no hace falta repetir su nombre en cada fila.
type CoachExceptionsCardProps = {
  clientId?: string | number
  variant?: 'dashboard' | 'compact'
}

type EditState = {
  item: ExceptionItem
  targetId: number
  proposedWeight: string
  proposedReps: string
  motivo: string
} | null

export default function CoachExceptionsCard({ clientId, variant = 'dashboard' }: CoachExceptionsCardProps) {
  const compact = variant === 'compact'
  const {
    items, loading, actingOn, fetchItems,
    resolve, dismiss, approveSuggestion, editSuggestion, rejectSuggestion, approveAdaptiveWeek, rejectAdaptiveWeek,
  } = useCoachExceptions({ clientId, status: 'pendiente' })

  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [editState, setEditState] = useState<EditState>(null)
  const [saving, setSaving] = useState(false)

  // El nombre del coach no viene en el payload del ítem (solo coach_id) --
  // se resuelve aquí con la misma lista ya usada por CoachExceptionsView.tsx.
  // Solo hace falta en el dashboard general (sin clientId fijo, sin coach
  // fijo), pero cargarla siempre es barato y evita un prop condicional más.
  useEffect(() => {
    if (compact) return
    api.get('/admin/coach-exceptions/coaches')
      .then(res => setCoaches(res.data?.data || res.data || []))
      .catch(() => {})
  }, [compact])

  const coachMap = useMemo(() => {
    const m = new Map<number, string>()
    coaches.forEach(c => m.set(c.id, c.name))
    return m
  }, [coaches])

  const sortedItems = useMemo(() => sortByUrgency(items), [items])

  const openEdit = useCallback((item: ExceptionItem) => {
    const detail = asSuggestionDetail(item)
    if (!detail) return
    setEditState({
      item,
      targetId: detail.target_id,
      proposedWeight: detail.proposed_weight != null ? String(detail.proposed_weight) : '',
      proposedReps: detail.proposed_reps != null ? String(detail.proposed_reps) : '',
      motivo: '',
    })
  }, [])

  const handleSaveEdit = async () => {
    if (!editState) return
    setSaving(true)
    const payload: { proposed_weight?: number; proposed_reps?: number; motivo?: string } = {}
    if (editState.proposedWeight.trim() !== '') payload.proposed_weight = Number(editState.proposedWeight)
    if (editState.proposedReps.trim() !== '') payload.proposed_reps = Number(editState.proposedReps)
    if (editState.motivo.trim() !== '') payload.motivo = editState.motivo.trim()
    const ok = await editSuggestion(editState.item, editState.targetId, payload)
    setSaving(false)
    if (ok) setEditState(null)
  }

  const Wrapper = compact ? Card : DashboardCard
  const headerClass = compact ? 'pb-2 flex flex-row items-center justify-between space-y-0' : 'border-b border-border flex flex-row items-center justify-between space-y-0'
  const titleClass = compact ? 'text-sm flex items-center gap-2' : 'flex items-center gap-2'

  return (
    <Wrapper className={compact ? undefined : 'flex flex-col gap-0!'}>
      <CardHeader className={headerClass}>
        <CardTitle className={titleClass}>
          <AlertTriangle className={compact ? 'size-4' : 'size-4 text-muted-foreground'} />
          Excepciones pendientes
          {!loading && items.length > 0 && (
            <Badge variant='secondary' className={compact ? 'text-[10px]' : ''}>{items.length}</Badge>
          )}
        </CardTitle>
        <Button
          variant='ghost' size={compact ? 'icon-sm' : 'icon'}
          onClick={fetchItems} disabled={loading} title='Actualizar'
          className={compact ? 'h-6 w-6' : undefined}
        >
          <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent className={compact ? 'pt-2' : 'px-4 py-4'}>
        {loading && items.length === 0 ? (
          <div className={cn('flex justify-center', compact ? 'py-4' : 'py-10')}>
            <div className='h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent' />
          </div>
        ) : sortedItems.length === 0 ? (
          <p className={cn('text-center text-muted-foreground', compact ? 'text-xs py-3' : 'text-sm py-8')}>
            Nada pendiente — todo al día.
          </p>
        ) : (
          <SimpleBar className={compact ? 'max-h-[420px]' : 'max-h-[520px]'}>
            <div className={compact ? 'space-y-2 pr-2' : 'space-y-2.5 pr-2'}>
              {sortedItems.map(item => (
                <ExceptionRow
                  key={item.id}
                  item={item}
                  compact={compact}
                  showClient={!clientId}
                  coachName={coachMap.get(item.coach_id)}
                  actingOn={actingOn}
                  onResolve={() => resolve(item)}
                  onDismiss={() => dismiss(item)}
                  onApproveSuggestion={(targetId) => approveSuggestion(item, targetId)}
                  onRejectSuggestion={(targetId) => rejectSuggestion(item, targetId)}
                  onEditSuggestion={() => openEdit(item)}
                  onApproveAdaptiveWeek={(planId) => approveAdaptiveWeek(item, planId)}
                  onRejectAdaptiveWeek={(planId) => rejectAdaptiveWeek(item, planId)}
                />
              ))}
            </div>
          </SimpleBar>
        )}
      </CardContent>

      <Dialog open={!!editState} onOpenChange={(open) => { if (!open) setEditState(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar sugerencia de carga</DialogTitle></DialogHeader>
          {editState && (
            <FieldGroup className='gap-4'>
              <div className='grid grid-cols-2 gap-3'>
                <Field className='gap-2'>
                  <FieldLabel>Peso propuesto (kg)</FieldLabel>
                  <Input
                    type='number' step='0.5' value={editState.proposedWeight}
                    onChange={e => setEditState(s => s ? { ...s, proposedWeight: e.target.value } : s)}
                  />
                </Field>
                <Field className='gap-2'>
                  <FieldLabel>Reps propuestas</FieldLabel>
                  <Input
                    type='number' step='1' value={editState.proposedReps}
                    onChange={e => setEditState(s => s ? { ...s, proposedReps: e.target.value } : s)}
                  />
                </Field>
              </div>
              <Field className='gap-2'>
                <FieldLabel>Motivo (opcional)</FieldLabel>
                <Textarea
                  rows={2} value={editState.motivo}
                  onChange={e => setEditState(s => s ? { ...s, motivo: e.target.value } : s)}
                  placeholder='Por qué se ajusta la propuesta del motor...'
                />
              </Field>
            </FieldGroup>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditState(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar y aplicar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Wrapper>
  )
}

function ExceptionRow({
  item, compact, showClient, coachName, actingOn,
  onResolve, onDismiss, onApproveSuggestion, onRejectSuggestion, onEditSuggestion, onApproveAdaptiveWeek, onRejectAdaptiveWeek,
}: {
  item: ExceptionItem
  compact: boolean
  showClient: boolean
  coachName?: string
  actingOn: number | null
  onResolve: () => void
  onDismiss: () => void
  onApproveSuggestion: (targetId: number) => void
  onRejectSuggestion: (targetId: number) => void
  onEditSuggestion: () => void
  onApproveAdaptiveWeek: (planId: number) => void
  onRejectAdaptiveWeek: (planId: number) => void
}) {
  const meta = CATEGORY_META[item.category]
  const Icon = meta?.icon || AlertTriangle
  const busy = actingOn === item.id
  const suggestionDetail = isSuggestionCategory(item.category) ? asSuggestionDetail(item) : null
  const adaptiveDetail = isAdaptiveWeekCategory(item.category) ? asAdaptiveWeekDetail(item) : null

  return (
    <div className={cn('rounded-lg border transition-colors', cardAccentClass(item), compact ? 'p-2.5' : 'p-3')}>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-start gap-2.5 min-w-0'>
          <div className={cn('flex items-center justify-center rounded-lg bg-background border shrink-0', compact ? 'size-7' : 'size-8')}>
            <Icon className={compact ? 'size-3.5' : 'size-4'} />
          </div>
          <div className='min-w-0'>
            <div className='flex items-center gap-1.5 flex-wrap'>
              <p className={cn('font-medium', compact ? 'text-xs' : 'text-sm')}>{item.title}</p>
              <Badge variant={severityBadgeVariant(item.severity)} className={compact ? 'text-[9px]' : undefined}>{item.severity}</Badge>
              <Badge variant='outline' className={compact ? 'text-[9px]' : undefined}>{meta?.label || item.category}</Badge>
            </div>
            {item.description && (
              <p className={cn('text-muted-foreground mt-1', compact ? 'text-[10px] line-clamp-2' : 'text-xs')}>{item.description}</p>
            )}

            {suggestionDetail && (
              <p className={cn('text-muted-foreground mt-1', compact ? 'text-[10px]' : 'text-xs')}>
                {suggestionDetail.exercise && <span className='font-medium text-foreground'>{suggestionDetail.exercise}</span>}
                {suggestionDetail.proposed_weight != null && <> · {suggestionDetail.proposed_weight} kg</>}
                {suggestionDetail.proposed_reps != null && <> × {suggestionDetail.proposed_reps} reps</>}
                {suggestionDetail.proposed_exercise && <> · sustituir por <span className='font-medium text-foreground'>{suggestionDetail.proposed_exercise}</span></>}
              </p>
            )}
            {adaptiveDetail && (
              <p className={cn('text-muted-foreground mt-1', compact ? 'text-[10px]' : 'text-xs')}>
                Mantiene {adaptiveDetail.sessions_kept} de {adaptiveDetail.sessions_total ?? (adaptiveDetail.sessions_kept + adaptiveDetail.sessions_dropped)} sesiones
                {adaptiveDetail.sessions_dropped > 0 && <> · recorta {adaptiveDetail.sessions_dropped}</>}
              </p>
            )}

            <p className={cn('text-muted-foreground mt-1', compact ? 'text-[9px]' : 'text-[11px]')}>
              {showClient && <>{clientLabel(item)} · </>}
              {coachName && <>coach: {coachName} · </>}
              {formatRelative(item.created_at)}
            </p>
          </div>
        </div>

        {item.status === 'pendiente' && (
          <div className='flex flex-col items-end gap-1 shrink-0'>
            {suggestionDetail ? (
              <div className='flex items-center gap-1'>
                <Button size='sm' variant='outline' disabled={busy} onClick={() => onApproveSuggestion(suggestionDetail.target_id)} className={compact ? 'h-6 px-1.5 text-[10px]' : undefined}>
                  <Check className={compact ? 'size-3 mr-0.5' : 'size-3.5 mr-1'} /> Aprobar
                </Button>
                <Button size='sm' variant='ghost' disabled={busy} onClick={onEditSuggestion} className={compact ? 'h-6 px-1.5 text-[10px]' : undefined}>
                  <PencilIcon className={compact ? 'size-3 mr-0.5' : 'size-3.5 mr-1'} /> Editar
                </Button>
                <Button size='sm' variant='ghost' disabled={busy} onClick={() => onRejectSuggestion(suggestionDetail.target_id)} className={compact ? 'h-6 px-1.5 text-[10px] text-destructive hover:text-destructive' : 'text-destructive hover:text-destructive'}>
                  <X className={compact ? 'size-3 mr-0.5' : 'size-3.5 mr-1'} /> Rechazar
                </Button>
              </div>
            ) : adaptiveDetail ? (
              <div className='flex items-center gap-1'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={busy}
                  onClick={() => onApproveAdaptiveWeek(adaptiveDetail.plan_id)}
                  className={compact ? 'h-6 px-1.5 text-[10px]' : undefined}
                  title='Esto reduce el calendario real del cliente de inmediato — no hay un paso de aplicación aparte.'
                >
                  <ThumbsUp className={compact ? 'size-3 mr-0.5' : 'size-3.5 mr-1'} /> Aprobar semana
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  disabled={busy}
                  onClick={() => onRejectAdaptiveWeek(adaptiveDetail.plan_id)}
                  className={compact ? 'h-6 px-1.5 text-[10px] text-destructive hover:text-destructive' : 'text-destructive hover:text-destructive'}
                >
                  <X className={compact ? 'size-3 mr-0.5' : 'size-3.5 mr-1'} /> Rechazar
                </Button>
              </div>
            ) : (
              <div className='flex items-center gap-1'>
                <Button size='sm' variant='outline' disabled={busy} onClick={onResolve} className={compact ? 'h-6 px-1.5 text-[10px]' : undefined}>
                  <Check className={compact ? 'size-3 mr-0.5' : 'size-3.5 mr-1'} /> Resolver
                </Button>
                <Button size='sm' variant='ghost' disabled={busy} onClick={onDismiss} className={compact ? 'h-6 px-1.5 text-[10px]' : undefined}>
                  <X className={compact ? 'size-3 mr-0.5' : 'size-3.5 mr-1'} /> Descartar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
