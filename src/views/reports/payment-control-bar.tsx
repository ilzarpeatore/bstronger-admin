import { useCallback, useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PaymentControlSettings } from '@/types/apps/subscription-payments'
import { formatShortDate } from '@/components/users/payment-control-utils'

// Interruptor global del aviso/bloqueo por impago (Bckbs docs/AVISO_IMPAGO.md).
// Apagado por defecto: hasta que se active, a ningún cliente le sale aviso ni
// bloqueo. Al activarlo, quien deba el mes tiene 3 días de aviso desde hoy.

function unwrap(res: any): PaymentControlSettings {
  return (res?.data?.data ?? res?.data ?? res) as PaymentControlSettings
}

export default function PaymentControlBar({ onChanged }: { onChanged?: () => void }) {
  const [settings, setSettings] = useState<PaymentControlSettings | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setSettings(unwrap(await api.get('/admin/payment-control/settings')))
    } catch {
      setSettings(null)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!settings) return null

  const toggle = async () => {
    const enable = !settings.stored_enabled
    const question = enable
      ? `¿Activar el control de impago?\n\nLos clientes 1:1 que no tengan marcado el mes en curso verán un aviso durante ${settings.warning_days} días (desde hoy) y después se les bloquearán entrenamientos y nutrición en la app hasta que marques el pago.\n\nAhora mismo: ${settings.counts.warning + settings.counts.blocked + settings.counts.grace} clientes pendientes.`
      : '¿Desactivar el control de impago? Se levantan al momento todos los avisos y bloqueos.'
    if (!window.confirm(question)) return
    setSaving(true)
    try {
      setSettings(unwrap(await api.put('/admin/payment-control/settings', { enabled: enable })))
      toast.success(enable ? 'Control de impago activado' : 'Control de impago desactivado')
      onChanged?.()
    } catch (e) {
      toast.error(e instanceof ApiError && e.message ? e.message : 'No se pudo cambiar el control de impago')
    } finally {
      setSaving(false)
    }
  }

  const pending = settings.counts.warning + settings.counts.blocked
  const Icon = settings.enabled ? ShieldAlert : ShieldCheck

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border px-4 py-3 text-sm',
        settings.enabled ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-muted/40',
      )}
    >
      <div className='flex items-start gap-2.5 min-w-0'>
        <Icon size={16} className={cn('mt-0.5 shrink-0', settings.enabled ? 'text-amber-600' : 'text-muted-foreground')} />
        <div className='min-w-0'>
          <p className='font-medium'>
            Control de impago {settings.enabled ? 'activado' : 'desactivado'}
            {settings.enabled && settings.since && <span className='font-normal text-muted-foreground'> desde el {formatShortDate(settings.since)}</span>}
          </p>
          <p className='text-xs text-muted-foreground'>
            {settings.force_off
              ? 'Apagado por el servidor (BILLING_ENFORCEMENT_FORCE_OFF). El botón no tiene efecto hasta quitarlo del .env.'
              : settings.enabled
                ? `Clientes 1:1 sin el mes marcado: ${settings.warning_days} días de aviso en la app y después bloqueo de entrenamientos y nutrición. Ahora: ${settings.counts.warning} en aviso, ${settings.counts.blocked} bloqueados, ${settings.counts.grace} en gracia.`
                : `A nadie le sale aviso ni bloqueo. Si lo activas hoy: ${pending} clientes empezarían con ${settings.warning_days} días de aviso.`}
          </p>
        </div>
      </div>
      <Button
        variant={settings.stored_enabled ? 'outline' : 'default'}
        onClick={toggle}
        disabled={saving}
        className='gap-2 cursor-pointer shrink-0'
      >
        {saving && <Loader2 size={14} className='animate-spin' />}
        {settings.stored_enabled ? 'Desactivar control de impago' : 'Activar control de impago'}
      </Button>
    </div>
  )
}
