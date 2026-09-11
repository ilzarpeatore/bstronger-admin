import { Suspense, lazy } from 'react'
import { BarChart3, Dumbbell, Apple, ClipboardCheck, MessageSquare, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { KpiData } from './KpiComparisonCard'
import KpiComparisonCard from './KpiComparisonCard'

const KpisBarChart = lazy(() => import('./KpisBarChart'))

export type DashboardKpis = {
  altas_mes: KpiData
  retencion: KpiData
  entrenamientos_completados: KpiData
  cumplimiento_dietas: KpiData
  checkins_enviados: KpiData
  checkins_respondidos: KpiData
  tasa_respuesta: KpiData
  ingresos: KpiData
  nuevas_suscripciones: KpiData
}

const kpisList: { key: keyof DashboardKpis; title: string; icon: LucideIcon; format: 'number' | 'currency' | 'percentage' }[] = [
  { key: 'altas_mes', title: 'Altas del período', icon: UserPlus, format: 'number' },
  { key: 'retencion', title: 'Retención', icon: ClipboardCheck, format: 'percentage' },
  { key: 'entrenamientos_completados', title: 'Entrenos completados', icon: Dumbbell, format: 'number' },
  { key: 'cumplimiento_dietas', title: 'Cumplimiento dietas', icon: Apple, format: 'percentage' },
  { key: 'checkins_enviados', title: 'Check-ins enviados', icon: MessageSquare, format: 'number' },
  { key: 'checkins_respondidos', title: 'Check-ins respondidos', icon: MessageSquare, format: 'number' },
  { key: 'tasa_respuesta', title: 'Tasa de respuesta', icon: ClipboardCheck, format: 'percentage' },
  { key: 'ingresos', title: 'Ingresos', icon: BarChart3, format: 'currency' },
  { key: 'nuevas_suscripciones', title: 'Nuevas suscripciones', icon: UserPlus, format: 'number' },
]

export default function KpiSection({ kpis, loading }: { kpis: DashboardKpis | null; loading: boolean }) {
  if (loading && !kpis) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[120px] rounded-none bg-muted/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!kpis) return null

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {kpisList.slice(0, 5).map((item) => (
          <KpiComparisonCard
            key={item.key}
            title={item.title}
            kpi={kpis[item.key]}
            format={item.format}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpisList.slice(5).map((item) => (
          <KpiComparisonCard
            key={item.key}
            title={item.title}
            kpi={kpis[item.key]}
            format={item.format}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<div className="h-[300px] rounded-none bg-muted/50 animate-pulse" />}>
          <KpisBarChart
            title="Entrenamientos completados"
            data={[
              { label: 'Este período', value: kpis.entrenamientos_completados.periodo_actual },
              { label: 'Período anterior', value: kpis.entrenamientos_completados.periodo_anterior },
            ]}
          />
        </Suspense>
        <Suspense fallback={<div className="h-[300px] rounded-none bg-muted/50 animate-pulse" />}>
          <KpisBarChart
            title="Check-ins"
            data={[
              { label: 'Enviados', value: kpis.checkins_enviados.periodo_actual },
              { label: 'Respondidos', value: kpis.checkins_respondidos.periodo_actual },
            ]}
          />
        </Suspense>
      </div>
    </>
  )
}
