import { Users, Target } from 'lucide-react'
import { CardContent } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'
import { cn } from '@/lib/utils'

function SimpleBar({ value, barClass }: { value: number; barClass?: string }) {
  return (
    <div className="relative flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full bg-primary transition-all', barClass)}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  )
}

export type CoachMetric = {
  coach_id: number
  coach_name: string
  clientes_activos: number
  total_clientes: number
  pct_con_plan: number
  pct_completan_80: number
}

type CoachingMetricsCardProps = {
  metrics: CoachMetric[]
  totals: {
    total_clientes: number
    clientes_activos: number
    pct_con_plan_promedio: number
    pct_completan_80_promedio: number
  }
}

export default function CoachingMetricsCard({ metrics, totals }: CoachingMetricsCardProps) {
  return (
    <DashboardCard className="flex flex-col gap-0!">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Target size={16} className="text-muted-foreground" />
          Métricas de coaching
        </h3>
      </div>
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Clientes activos</span>
            <span className="text-2xl font-semibold">{totals.clientes_activos}</span>
            <span className="text-xs text-muted-foreground">de {totals.total_clientes} totales</span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Con plan asignado</span>
            <span className="text-2xl font-semibold">{totals.pct_con_plan_promedio}%</span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Completan ≥80% semana</span>
            <span className="text-2xl font-semibold">{totals.pct_completan_80_promedio}%</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-medium text-muted-foreground">Por coach</h4>
          {metrics.map((m) => (
            <div key={m.coach_id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium">{m.coach_name}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {m.clientes_activos}/{m.total_clientes} activos
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Con plan</span>
                    <span className="font-medium">{m.pct_con_plan}%</span>
                  </div>
                  <SimpleBar value={m.pct_con_plan} />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">≥80% semana</span>
                    <span className="font-medium">{m.pct_completan_80}%</span>
                  </div>
                  <SimpleBar value={m.pct_completan_80} barClass="bg-chart-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </DashboardCard>
  )
}
