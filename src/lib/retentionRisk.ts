// Score de Riesgo de Abandono (docs/Score_Riesgo_Abandono_Implementacion.md).
// Tipos/helpers compartidos entre RetentionRiskCard.tsx (ficha de cliente)
// y RetentionRiskSettingsDialog.tsx (configuración por coach) -- mismo
// criterio que lib/coachExceptions.ts para el resto del Motor.

export type RiskBand = 'bajo' | 'medio' | 'alto' | 'dato_insuficiente'

export type DominantComponent = 'inactividad' | 'compliance' | 'logro' | 'dolor'

export type RetentionRiskRow = {
  client_id: number
  client: { id: number; name: string } | null
  date: string
  band: RiskBand
  combined_score: number | null
  dias_inactividad: number | null
  compliance_actual: number | null
  compliance_anterior: number | null
  dias_desde_ultimo_logro: number | null
  dolor_score: number | null
  dominant_component: DominantComponent | null
}

export type RetentionRiskHistoryPoint = {
  date: string
  band: RiskBand
  combined_score: number | null
  dias_inactividad: number | null
}

export type RetentionRiskHistory = {
  current: RetentionRiskRow | null
  history: RetentionRiskHistoryPoint[]
}

export type RetentionRiskConfig = {
  w1: number | null
  w2: number | null
  w3: number | null
  w4: number | null
  auto_reengagement_enabled: boolean
  msg_dia_7: string | null
  msg_dia_14: string | null
  msg_dia_20: string | null
  defaults: {
    w1: number; w2: number; w3: number; w4: number
    msg_dia_7: string; msg_dia_14: string; msg_dia_20: string
  }
}

export const BAND_META: Record<RiskBand, { label: string; badgeVariant: 'destructive' | 'default' | 'secondary' | 'outline'; barClass: string }> = {
  alto: { label: 'Riesgo alto', badgeVariant: 'destructive', barClass: 'bg-red-500' },
  medio: { label: 'Riesgo medio', badgeVariant: 'default', barClass: 'bg-amber-500' },
  bajo: { label: 'Riesgo bajo', badgeVariant: 'secondary', barClass: 'bg-emerald-500' },
  dato_insuficiente: { label: 'Datos insuficientes', badgeVariant: 'outline', barClass: 'bg-muted-foreground' },
}

export const DOMINANT_LABELS: Record<DominantComponent, string> = {
  inactividad: 'Días sin entrenar',
  compliance: 'Caída de cumplimiento',
  logro: 'Sin logros recientes',
  dolor: 'Molestias recurrentes',
}

export function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${Math.round(v * 100)}%`
}
