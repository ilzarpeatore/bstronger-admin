import { TrendingUp, TrendingDown } from 'lucide-react'
import { CardContent } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'
import { cn } from '@/lib/utils'

export type KpiData = {
  periodo_actual: number
  periodo_anterior: number
  cambio_pct: number
}

type KpiComparisonCardProps = {
  title: string
  kpi: KpiData
  format?: 'number' | 'currency' | 'percentage'
  variant?: 'default' | 'outline'
}

export default function KpiComparisonCard({
  title,
  kpi,
  format = 'number',
  variant = 'default',
}: KpiComparisonCardProps) {
  const isPositive = kpi.cambio_pct >= 0
  const TrendIcon = isPositive ? TrendingUp : TrendingDown

  const formatValue = (val: number) => {
    if (format === 'currency') return `$${val.toLocaleString()}`
    if (format === 'percentage') return `${val.toFixed(1)}%`
    return val.toLocaleString()
  }

  return (
    <DashboardCard className={cn('py-5', variant === 'outline' && 'border-2 border-primary/20')}>
      <CardContent className="flex flex-col gap-2 px-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className="flex items-end gap-2">
          <h3 className="text-2xl font-semibold leading-none">{formatValue(kpi.periodo_actual)}</h3>
          <span
            className={cn(
              'flex items-center gap-0.5 text-sm font-medium',
              isPositive ? 'text-chart-2' : 'text-destructive',
            )}
          >
            <TrendIcon size={14} />
            {Math.abs(kpi.cambio_pct).toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">{formatValue(kpi.periodo_anterior)}</span> período anterior
        </p>
      </CardContent>
    </DashboardCard>
  )
}
