import type { BillingSummary } from '@/types/apps/subscription-payments'

// Aviso de pago pendiente / bloqueo por impago (Bckbs docs/AVISO_IMPAGO.md):
// textos y colores del estado de un cliente, compartidos por la ficha del
// cliente y Seguimiento de pagos.

export type BillingTone = 'ok' | 'muted' | 'warning' | 'danger' | 'info'

export const TONE_CLASS: Record<BillingTone, string> = {
  ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  muted: 'border-border bg-muted text-muted-foreground',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function billingLabel(b: Pick<BillingSummary, 'state' | 'day' | 'grace_until' | 'block_date'>): { label: string; tone: BillingTone } {
  switch (b.state) {
    case 'ok':
      return { label: 'Al día', tone: 'ok' }
    case 'exempt':
      return { label: 'Exento', tone: 'muted' }
    case 'grace':
      return { label: `Gracia hasta ${formatShortDate(b.grace_until)}`, tone: 'info' }
    case 'warning':
      return { label: `Aviso día ${b.day ?? 1}`, tone: 'warning' }
    case 'blocked':
      return { label: 'Bloqueado', tone: 'danger' }
    default:
      return { label: 'No aplica', tone: 'muted' }
  }
}

/** Nota cuando el control global está apagado: el estado es solo una previsión. */
export function previewNote(b: Pick<BillingSummary, 'enforcement_enabled' | 'state'>): string | null {
  if (b.enforcement_enabled) return null
  if (b.state === 'warning' || b.state === 'blocked' || b.state === 'grace') {
    return 'Control desactivado: es lo que pasaría si lo activas hoy.'
  }
  return null
}
