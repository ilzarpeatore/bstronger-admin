import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Utilidades comunes de las secciones de Marketing (Bckbs docs/MARKETING_WEB.md).

export type Pagination = { total_items?: number; currentPage?: number; totalPages?: number }

export const PER_PAGE = 25

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function formatMoney(value: number | null | undefined, currency = 'EUR') {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('es-ES').format(value)
}

export function percent(part: number, total: number) {
  if (!total) return '—'
  return `${Math.round((part / total) * 1000) / 10}%`
}

const clickIdLabels: Record<string, string> = {
  gclid: 'Google Ads',
  fbclid: 'Meta (Facebook/Instagram)',
  ttclid: 'TikTok Ads',
  msclkid: 'Microsoft Ads',
  li_fat_id: 'LinkedIn Ads',
}

export function clickIdLabel(type: string) {
  return clickIdLabels[type] ?? type
}

/** De dónde vino alguien: campaña (UTM) si la hay, si no la web que le envió, si no "Directo". */
export function originLabel(o: { utm_source?: string | null; utm_campaign?: string | null; referrer_host?: string | null }) {
  if (o.utm_source || o.utm_campaign) return [o.utm_source, o.utm_campaign].filter(Boolean).join(' · ')
  return o.referrer_host || 'Directo'
}

export function StatTile({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon?: LucideIcon }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>{label}</span>
          {Icon ? <Icon className="size-4" /> : null}
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}

export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
      <span>Página {page} de {totalPages}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Siguiente</Button>
    </div>
  )
}
