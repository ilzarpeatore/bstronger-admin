import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, LockIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import ClientPicker from './ClientPicker'
import {
  WIZARD_STEPS,
  applyMetric,
  emptyForm,
  formFromChallenge,
  isRulesLocked,
  metricHelp,
  stepOfError,
  toPayload,
  todayMadrid,
  validateChallengeForm,
  type ChallengeDetail,
  type ChallengeFormValues,
  type ChallengeMetric,
  type ClientOption,
  type FormErrors,
} from './challengeForm'

export type Option = { id: number; title: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = crear. */
  editing: ChallengeDetail | null
  metrics: ChallengeMetric[]
  programs: Option[]
  habitTemplates: Option[]
  onSaved: (id: number) => void
}

const Err = ({ msg }: { msg?: string }) => (msg ? <p className='text-xs text-destructive'>{msg}</p> : null)

const FORMAT_INFO = {
  threshold: { label: 'Objetivo', help: 'Completa el reto todo el que llega a la meta. Recomendado: nadie queda «último».' },
  leaderboard: { label: 'Ranking', help: 'Clasificación por puesto. Útil con premio para el top 3; favorece a los más avanzados.' },
} as const

const ChallengeWizard = ({ open, onOpenChange, editing, metrics, programs, habitTemplates, onSaved }: Props) => {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<ChallengeFormValues>(emptyForm)
  const [invites, setInvites] = useState<ClientOption[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [eligible, setEligible] = useState<number | null>(null)
  const [eligibleLoading, setEligibleLoading] = useState(false)

  const locked = isRulesLocked(editing)
  const today = todayMadrid()

  useEffect(() => {
    if (!open) return
    setStep(0)
    setErrors({})
    setInvites([])
    setEligible(null)
    setForm(editing ? formFromChallenge(editing) : emptyForm())
  }, [open, editing])

  const metric = useMemo(() => metrics.find(m => m.key === form.metric_key), [metrics, form.metric_key])
  const existingIds = useMemo(() => (editing?.participants ?? []).map(p => p.client_id), [editing])
  const alreadyInvited = useMemo(
    () => (editing?.participants ?? []).filter(p => p.status === 'invited' || p.status === 'joined').length,
    [editing],
  )

  // Vista previa de cuántos clientes verían el reto abierto.
  useEffect(() => {
    if (!open || step !== 3 || form.visibility !== 'open') return
    let cancelled = false
    setEligibleLoading(true)
    const params = new URLSearchParams({ paid_only: form.paid_only ? '1' : '0' })
    if (form.library_program_id) params.set('library_program_id', form.library_program_id)
    api.get(`/admin/challenge-preview-eligible?${params}`)
      .then(res => { if (!cancelled) setEligible(Number(res?.data?.count ?? 0)) })
      .catch(() => { if (!cancelled) { setEligible(null); toast.error('No se pudo calcular cuántos clientes lo verían') } })
      .finally(() => { if (!cancelled) setEligibleLoading(false) })
    return () => { cancelled = true }
  }, [open, step, form.visibility, form.paid_only, form.library_program_id])

  const set = <K extends keyof ChallengeFormValues>(key: K, value: ChallengeFormValues[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }
  const setParam = (key: string, value: string) => {
    setForm(prev => ({ ...prev, metric_params: { ...prev.metric_params, [key]: value } }))
    setErrors(prev => ({ ...prev, [`param.${key}`]: undefined }))
  }

  const validate = (mode: 'draft' | 'publish') =>
    validateChallengeForm(form, {
      metrics,
      today,
      mode,
      originalStartDate: editing?.start_date?.slice(0, 10),
      originalJoinDeadline: editing?.join_deadline?.slice(0, 10),
      inviteCount: alreadyInvited + invites.length,
    })

  const errorsOfStep = (errs: FormErrors, s: number) =>
    Object.entries(errs).filter(([k, v]) => v && stepOfError(k) === s)

  const next = () => {
    const errs = validate('publish')
    const mine = errorsOfStep(errs, step)
    if (mine.length) {
      setErrors(errs)
      return
    }
    setStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1))
  }

  const save = async (target: 'draft' | 'scheduled' | 'keep') => {
    const errs = validate(target === 'draft' ? 'draft' : 'publish')
    const keys = Object.keys(errs).filter(k => errs[k as keyof FormErrors])
    if (keys.length) {
      setErrors(errs)
      setStep(Math.min(...keys.map(stepOfError)))
      toast.error('Revisa los campos marcados')
      return
    }
    const status = target === 'keep' ? (editing?.status === 'draft' ? 'draft' : 'scheduled') : target
    const payload: Record<string, unknown> = toPayload(form, metric, status)
    if (locked) {
      // Una vez activo no se pueden cambiar métrica, formato ni inicio, ni el estado desde aquí.
      for (const k of ['metric_key', 'metric_params', 'format', 'start_date', 'status', 'visibility']) delete payload[k]
    }
    const clientIds = form.visibility === 'closed' ? invites.map(c => c.id) : []
    setSaving(true)
    try {
      let id: number
      if (editing) {
        await api.post(`/admin/challenge-update/${editing.id}`, payload)
        id = editing.id
        if (clientIds.length) await api.post(`/admin/challenge-invite/${id}`, { client_ids: clientIds })
      } else {
        const res = await api.post('/admin/challenge-store', clientIds.length ? { ...payload, client_ids: clientIds } : payload)
        id = Number(res?.data?.id)
      }
      toast.success(
        target === 'draft' ? 'Borrador guardado'
          : target === 'scheduled' && editing?.status !== 'scheduled' ? 'Reto publicado'
            : 'Reto actualizado',
      )
      onOpenChange(false)
      onSaved(id)
    } catch (err: unknown) {
      const e = err as { message?: string; data?: { errors?: Record<string, string[]> } }
      const first = e?.data?.errors ? Object.values(e.data.errors)[0]?.[0] : undefined
      toast.error(first || e?.message || 'Error al guardar el reto')
    } finally {
      setSaving(false)
    }
  }

  const isLast = step === WIZARD_STEPS.length - 1
  const isDraft = !editing || editing.status === 'draft'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{editing ? `Editar reto: ${editing.title}` : 'Nuevo reto'}</DialogTitle>
          <DialogDescription>
            {locked ? 'El reto ya ha empezado: el tipo, la métrica, el formato y la fecha de inicio no se pueden cambiar.' : 'Los clientes solo verán el reto cuando lo publiques.'}
          </DialogDescription>
        </DialogHeader>

        <ol className='flex flex-wrap gap-2'>
          {WIZARD_STEPS.map((label, i) => {
            const hasErr = errorsOfStep(errors, i).length > 0
            return (
              <li key={label}>
                <button
                  type='button'
                  onClick={() => setStep(i)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    i === step ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                    hasErr && i !== step && 'border-destructive text-destructive',
                  )}
                >
                  <span>{i + 1}</span> {label}
                </button>
              </li>
            )
          })}
        </ol>

        {step === 0 && (
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel htmlFor='ch-title'>Título</FieldLabel>
              <Input id='ch-title' value={form.title} maxLength={120} onChange={e => set('title', e.target.value)} aria-invalid={!!errors.title} />
              <Err msg={errors.title} />
            </Field>
            <Field className='gap-2'>
              <FieldLabel htmlFor='ch-desc'>Descripción</FieldLabel>
              <Textarea id='ch-desc' rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder='Qué hay que hacer y por qué merece la pena' />
              <Err msg={errors.description} />
            </Field>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field className='gap-2'>
                <FieldLabel htmlFor='ch-cover'>URL de portada (opcional)</FieldLabel>
                <Input id='ch-cover' type='url' placeholder='https://…' value={form.cover_url} onChange={e => set('cover_url', e.target.value)} aria-invalid={!!errors.cover_url} />
                <Err msg={errors.cover_url} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel htmlFor='ch-prize'>Premio (opcional)</FieldLabel>
                <Input id='ch-prize' placeholder='p. ej. Camiseta BeStronger' value={form.prize} onChange={e => set('prize', e.target.value)} />
                <Err msg={errors.prize} />
              </Field>
            </div>
            {form.cover_url && !errors.cover_url && (
              <img src={form.cover_url} alt='' className='h-28 w-full rounded-md border object-cover' onError={e => { e.currentTarget.style.display = 'none' }} />
            )}
            <Field className='gap-2'>
              <FieldLabel>Tipo</FieldLabel>
              <div className='grid gap-2 sm:grid-cols-2'>
                {([
                  { v: 'open', Icon: UsersIcon, title: 'Abierto', help: 'Lo ve y se apunta cualquier cliente que cumpla los criterios.' },
                  { v: 'closed', Icon: LockIcon, title: 'Cerrado', help: 'Tú eliges quién participa; les llega una invitación que deben aceptar.' },
                ] as const).map(o => (
                  <button
                    key={o.v}
                    type='button'
                    disabled={locked}
                    onClick={() => set('visibility', o.v)}
                    className={cn('flex gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60', form.visibility === o.v ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
                  >
                    <o.Icon className='mt-0.5 size-4 shrink-0' />
                    <span>
                      <span className='block font-medium'>{o.title}</span>
                      <span className='block text-xs text-muted-foreground'>{o.help}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Field>
          </FieldGroup>
        )}

        {step === 1 && (
          <FieldGroup className='gap-4'>
            <Field className='gap-2'>
              <FieldLabel>Métrica</FieldLabel>
              {metrics.length === 0 && <p className='text-muted-foreground'>No se pudo cargar el catálogo de métricas.</p>}
              <div className='grid gap-2 sm:grid-cols-2'>
                {metrics.map(m => (
                  <button
                    key={m.key}
                    type='button'
                    disabled={locked}
                    onClick={() => { setForm(prev => applyMetric(prev, m)); setErrors(prev => ({ ...prev, metric_key: undefined, format: undefined })) }}
                    className={cn(
                      'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      form.metric_key === m.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                    )}
                  >
                    <span className='flex items-center justify-between gap-2 font-medium'>
                      {m.label}
                      {form.metric_key === m.key && <CheckIcon className='size-4 text-primary' />}
                    </span>
                    <span className='text-xs text-muted-foreground'>{metricHelp(m)}</span>
                  </button>
                ))}
              </div>
              <Err msg={errors.metric_key} />
            </Field>

            {metric && metric.params.length > 0 && (
              <div className='grid gap-4 sm:grid-cols-2'>
                {metric.params.map(p => {
                  const value = form.metric_params[p.key] ?? ''
                  const err = errors[`param.${p.key}`]
                  const type = p.type ?? 'number'
                  return (
                    <Field key={p.key} className='gap-2'>
                      <FieldLabel>{p.label || p.key}</FieldLabel>
                      {type === 'habit_template' ? (
                        <NativeSelect className='w-full' value={value} disabled={locked} onChange={e => setParam(p.key, e.target.value)}>
                          <NativeSelectOption value=''>Elige un hábito…</NativeSelectOption>
                          {habitTemplates.map(h => <NativeSelectOption key={h.id} value={String(h.id)}>{h.title}</NativeSelectOption>)}
                        </NativeSelect>
                      ) : p.options?.length ? (
                        <NativeSelect className='w-full' value={value} disabled={locked} onChange={e => setParam(p.key, e.target.value)}>
                          <NativeSelectOption value=''>Elige…</NativeSelectOption>
                          {p.options.map(o => <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>)}
                        </NativeSelect>
                      ) : (
                        <Input
                          value={value}
                          disabled={locked}
                          inputMode={type === 'number' ? 'decimal' : 'text'}
                          placeholder={type === 'benchmark' ? 'p. ej. hyrox_sim' : undefined}
                          onChange={e => setParam(p.key, e.target.value)}
                          aria-invalid={!!err}
                        />
                      )}
                      <Err msg={err} />
                    </Field>
                  )
                })}
              </div>
            )}

            <Field className='gap-2'>
              <FieldLabel>Formato</FieldLabel>
              <div className='grid gap-2 sm:grid-cols-2'>
                {(['threshold', 'leaderboard'] as const).map(f => {
                  const allowed = !metric || metric.formats.includes(f)
                  return (
                    <button
                      key={f}
                      type='button'
                      disabled={!allowed || locked}
                      onClick={() => set('format', f)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        form.format === f ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                      )}
                    >
                      <span className='block font-medium'>{FORMAT_INFO[f].label}</span>
                      <span className='block text-xs text-muted-foreground'>{allowed ? FORMAT_INFO[f].help : 'No disponible para esta métrica.'}</span>
                    </button>
                  )
                })}
              </div>
              <Err msg={errors.format} />
            </Field>

            {form.format === 'threshold' && (
              <Field className='gap-2 sm:max-w-xs'>
                <FieldLabel htmlFor='ch-target'>Objetivo{metric?.unit ? ` (${metric.unit})` : ''}</FieldLabel>
                <Input id='ch-target' inputMode='decimal' value={form.threshold_value} onChange={e => set('threshold_value', e.target.value)} aria-invalid={!!errors.threshold_value} />
                <Err msg={errors.threshold_value} />
              </Field>
            )}
          </FieldGroup>
        )}

        {step === 2 && (
          <FieldGroup className='gap-4'>
            <div className='grid gap-4 sm:grid-cols-3'>
              <Field className='gap-2'>
                <FieldLabel htmlFor='ch-start'>Inicio</FieldLabel>
                <Input id='ch-start' type='date' disabled={locked} value={form.start_date} onChange={e => set('start_date', e.target.value)} aria-invalid={!!errors.start_date} />
                <Err msg={errors.start_date} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel htmlFor='ch-end'>Fin</FieldLabel>
                <Input id='ch-end' type='date' value={form.end_date} onChange={e => set('end_date', e.target.value)} aria-invalid={!!errors.end_date} />
                <Err msg={errors.end_date} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel htmlFor='ch-deadline'>Inscripción hasta (opcional)</FieldLabel>
                <Input id='ch-deadline' type='date' value={form.join_deadline} onChange={e => set('join_deadline', e.target.value)} aria-invalid={!!errors.join_deadline} />
                <Err msg={errors.join_deadline} />
              </Field>
            </div>
            <FieldDescription>Si publicas con inicio hoy, el reto se activa al momento. La puntuación se recalcula cada noche (23:30).</FieldDescription>
            <div className='grid gap-4 sm:grid-cols-2'>
              <Field className='gap-2'>
                <FieldLabel htmlFor='ch-min'>Mínimo de participantes</FieldLabel>
                <Input id='ch-min' inputMode='numeric' value={form.min_participants} onChange={e => set('min_participants', e.target.value)} aria-invalid={!!errors.min_participants} />
                <FieldDescription>Con menos de 3 unidos la clasificación no se muestra a los clientes.</FieldDescription>
                <Err msg={errors.min_participants} />
              </Field>
              <Field className='gap-2'>
                <FieldLabel htmlFor='ch-max'>Máximo de participantes (opcional)</FieldLabel>
                <Input id='ch-max' inputMode='numeric' value={form.max_participants} onChange={e => set('max_participants', e.target.value)} aria-invalid={!!errors.max_participants} />
                <Err msg={errors.max_participants} />
              </Field>
            </div>
            <Field className='gap-2'>
              <FieldLabel htmlFor='ch-program'>Restringir a un programa de la biblioteca (opcional)</FieldLabel>
              <NativeSelect id='ch-program' className='w-full' value={form.library_program_id} onChange={e => set('library_program_id', e.target.value)}>
                <NativeSelectOption value=''>Cualquier programa</NativeSelectOption>
                {programs.map(p => <NativeSelectOption key={p.id} value={String(p.id)}>{p.title}</NativeSelectOption>)}
              </NativeSelect>
              <FieldDescription>Para retos abiertos: solo lo verán los clientes que siguen ese programa. Comparar a gente con el mismo plan es lo más justo.</FieldDescription>
            </Field>
            <label className='flex items-center justify-between gap-4 rounded-lg border p-3'>
              <span>
                <span className='block font-medium'>Solo clientes de pago</span>
                <span className='block text-xs text-muted-foreground'>Los clientes gratuitos no lo verán ni podrán ser invitados.</span>
              </span>
              <Switch checked={form.paid_only} onCheckedChange={v => set('paid_only', !!v)} />
            </label>
          </FieldGroup>
        )}

        {step === 3 && (
          form.visibility === 'closed' ? (
            <div className='flex flex-col gap-2'>
              {alreadyInvited > 0 && <p className='text-muted-foreground'>Ya hay {alreadyInvited} cliente{alreadyInvited === 1 ? '' : 's'} invitado{alreadyInvited === 1 ? '' : 's'} o unido{alreadyInvited === 1 ? '' : 's'}. Añade más aquí.</p>}
              <ClientPicker selected={invites} onChange={v => { setInvites(v); setErrors(prev => ({ ...prev, invites: undefined })) }} excludeIds={existingIds} />
              <Err msg={errors.invites} />
            </div>
          ) : (
            <div className='rounded-lg border p-4'>
              <p className='text-muted-foreground'>Clientes que verían este reto abierto y podrían apuntarse:</p>
              <p className='text-3xl font-semibold tabular-nums'>{eligibleLoading ? '…' : eligible ?? '—'}</p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {form.paid_only ? 'Solo de pago' : 'Gratis y de pago'}
                {form.library_program_id ? ` · programa «${programs.find(p => String(p.id) === form.library_program_id)?.title ?? form.library_program_id}»` : ' · cualquier programa'}
              </p>
            </div>
          )
        )}

        <DialogFooter className='gap-2 sm:justify-between'>
          <Button variant='outline' onClick={() => (step === 0 ? onOpenChange(false) : setStep(s => s - 1))}>
            {step === 0 ? 'Cancelar' : 'Atrás'}
          </Button>
          <div className='flex flex-wrap justify-end gap-2'>
            {isDraft && (
              <Button variant='secondary' disabled={saving} onClick={() => save('draft')}>Guardar borrador</Button>
            )}
            {!isDraft && (
              <Button variant={isLast ? 'default' : 'secondary'} disabled={saving} onClick={() => save('keep')}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
            )}
            {!isLast ? (
              <Button onClick={next}>Siguiente</Button>
            ) : isDraft ? (
              <Button disabled={saving} onClick={() => save('scheduled')}>{saving ? 'Guardando…' : 'Publicar'}</Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ChallengeWizard
