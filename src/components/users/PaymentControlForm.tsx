import { useCallback, useEffect, useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { PaymentControlPayload } from '@/types/apps/subscription-payments'
import { TONE_CLASS, billingLabel, formatShortDate, previewNote } from './payment-control-utils'

// Control de impago de un cliente (Bckbs docs/AVISO_IMPAGO.md): estado del
// periodo vigente, exento, día de cobro y "dar X días de gracia". Se usa en
// la ficha del cliente (ClientPaymentControlCard) y en el popover de
// Seguimiento de pagos. Qué meses están pagados se sigue marcando en
// Seguimiento de pagos: aquí no se toca.

const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

function unwrap(res: any): PaymentControlPayload {
  return (res?.data?.data ?? res?.data ?? res) as PaymentControlPayload
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError && e.message) return e.message
  return 'No se pudo guardar el control de impago'
}

export default function PaymentControlForm({
  userId,
  compact = false,
  onChange,
  onLoaded,
}: {
  userId: string | number
  compact?: boolean
  onChange?: (payload: PaymentControlPayload) => void
  onLoaded?: (payload: PaymentControlPayload) => void
}) {
  const [payload, setPayload] = useState<PaymentControlPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [graceDays, setGraceDays] = useState('3')

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const next = unwrap(await api.get(`/admin/users/${userId}/payment-control`))
      setPayload(next)
      onLoaded?.(next)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
    // onLoaded se lee solo al cargar; no debe relanzar la carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const save = async (body: Record<string, unknown>, success: string) => {
    setSaving(true)
    try {
      const next = unwrap(await api.put(`/admin/users/${userId}/payment-control`, body))
      setPayload(next)
      onChange?.(next)
      toast.success(success)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <Loader2Icon className='size-4 animate-spin' /> Cargando control de impago…
      </div>
    )
  }

  if (failed || !payload) {
    return (
      <div className='flex items-center justify-between gap-3 text-sm text-muted-foreground'>
        <span>No se pudo cargar el control de impago.</span>
        <button type='button' onClick={load} className='text-xs font-medium underline underline-offset-2'>
          Reintentar
        </button>
      </div>
    )
  }

  const { status, settings } = payload
  const { label, tone } = billingLabel(status)
  const note = previewNote(status)
  const days = Number(graceDays)
  const validDays = Number.isInteger(days) && days >= 1 && days <= 60

  return (
    <div className={cn('flex flex-col', compact ? 'gap-2.5' : 'gap-3')}>
      <div className='flex flex-wrap items-center gap-2'>
        <span data-testid='billing-state' className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', TONE_CLASS[tone])}>
          {label}
        </span>
        <span className='text-xs text-muted-foreground'>
          {status.period.label}
          {status.amount != null && ` · ${currency.format(status.amount)}`}
          {status.paid ? ' · pagado' : ' · sin marcar'}
        </span>
      </div>
      {(status.state === 'warning' || status.state === 'blocked') && status.block_date && (
        <p className='text-xs text-muted-foreground'>
          {status.state === 'warning' ? 'Se bloquea el ' : 'Bloqueado desde el '}
          {formatShortDate(status.block_date)} si no se marca el mes como pagado.
        </p>
      )}
      {note && <p className='text-xs text-muted-foreground italic'>{note}</p>}

      <label className='flex items-center gap-2 text-sm cursor-pointer'>
        <input
          type='checkbox'
          aria-label='Exento del control de impago'
          checked={settings.exempt}
          disabled={saving}
          onChange={(e) => save({ exempt: e.target.checked }, e.target.checked ? 'Cliente exento del control de impago' : 'Control de impago activado para este cliente')}
          className='size-4 accent-primary'
        />
        Exento (nunca se le avisa ni se le bloquea)
      </label>

      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <label htmlFor={`due-day-${userId}`}>Día de cobro</label>
        <select
          id={`due-day-${userId}`}
          aria-label='Día de cobro'
          value={settings.due_day}
          disabled={saving}
          onChange={(e) => save({ due_day: Number(e.target.value) }, `Día de cobro: ${e.target.value}`)}
          className='h-8 rounded-md border bg-background px-2 text-sm disabled:opacity-60'
        >
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span className='text-xs text-muted-foreground'>de cada mes</span>
      </div>

      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <span>Gracia</span>
        <input
          type='number'
          min={1}
          max={60}
          aria-label='Días de gracia'
          value={graceDays}
          onChange={(e) => setGraceDays(e.target.value)}
          className='h-8 w-16 rounded-md border bg-background px-2 text-sm'
        />
        <button
          type='button'
          disabled={saving || !validDays}
          onClick={() => save({ grace_days: days }, `${days} días de gracia concedidos`)}
          className='h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50'
        >
          Dar días de gracia
        </button>
        {settings.grace_until && (
          <button
            type='button'
            disabled={saving}
            onClick={() => save({ grace_days: 0 }, 'Gracia retirada')}
            className='text-xs text-muted-foreground underline underline-offset-2'
          >
            Quitar (hasta {formatShortDate(settings.grace_until)})
          </button>
        )}
        {saving && <Loader2Icon className='size-4 animate-spin text-muted-foreground' />}
      </div>
    </div>
  )
}
