import { BarChart3, ClipboardCheck, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { KpiData } from './KpiComparisonCard'
import KpiComparisonCard from './KpiComparisonCard'

// FIX (auditoría 2026-09-13): 'entrenamientos_completados',
// 'cumplimiento_dietas', 'checkins_enviados', 'checkins_respondidos' y
// 'tasa_respuesta' eran literales fijos en el backend (nunca calculados de
// datos reales) -- quitados del dashboard hasta que exista una fuente real
// que los calcule de verdad.
export type DashboardKpis = {
  altas_mes: KpiData
  retencion: KpiData
  ingresos: KpiData
  nuevas_suscripciones: KpiData
}

const kpisList: { key: keyof DashboardKpis; title: string; icon: LucideIcon; format: 'number' | 'currency' | 'percentage' }[] = [
  { key: 'altas_mes', title: 'Altas del período', icon: UserPlus, format: 'number' },
  { key: 'retencion', title: 'Retención', icon: ClipboardCheck, format: 'percentage' },
  { key: 'ingresos', title: 'Ingresos', icon: BarChart3, format: 'currency' },
  { key: 'nuevas_suscripciones', title: 'Nuevas suscripciones', icon: UserPlus, format: 'number' },
]

export default function KpiSection({ kpis, loading }: { kpis: DashboardKpis | null; loading: boolean }) {
  if (loading && !kpis) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[120px] rounded-none bg-muted/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!kpis) return null

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpisList.map((item) => (
        <KpiComparisonCard
          key={item.key}
          title={item.title}
          kpi={kpis[item.key]}
          format={item.format}
        />
      ))}
    </div>
  )
}
