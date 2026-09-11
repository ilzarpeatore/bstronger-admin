import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Clock, Dumbbell } from 'lucide-react'
import { api } from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CardContent } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type RevenueData = {
  revenue_current_cents: number
  revenue_previous_cents: number
  revenue_change_pct: number
  by_type: Record<string, { count: number; revenue_cents: number }>
  users_active: number
  users_free: number
  users_total: number
  expiring_soon: { id: number; subscriber_name: string; plan_name: string; ends_at: string; days_left: number }[]
}

export default function RevenueView() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/reports/revenue?period=${period}`)
      setData(res.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const fmtEur = (cents: number) => `€${(cents / 100).toFixed(2)}`

  if (loading && !data) {
    return <div className="flex flex-col gap-4">
      <div className="h-[200px] rounded-none bg-muted/50 animate-pulse" />
    </div>
  }

  if (!data) return null

  const isPositive = data.revenue_change_pct >= 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ingresos</h2>
          <p className="text-sm text-muted-foreground">Panel de facturación y control de suscripciones</p>
        </div>
        <Select value={period} onValueChange={(v) => v && setPeriod(v)}>
          <SelectTrigger className="w-[140px] cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
            <SelectItem value="year">Este año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard className="py-5">
          <CardContent className="flex flex-col gap-1 px-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ingresos del período</p>
            <h3 className="text-2xl font-semibold">{fmtEur(data.revenue_current_cents)}</h3>
            <span className={cn('flex items-center gap-0.5 text-sm font-medium', isPositive ? 'text-chart-2' : 'text-destructive')}>
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(data.revenue_change_pct)}%
            </span>
          </CardContent>
        </DashboardCard>

        <DashboardCard className="py-5">
          <CardContent className="flex flex-col gap-1 px-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Usuarios activos</p>
            <h3 className="text-2xl font-semibold">{data.users_active}</h3>
            <span className="text-sm text-muted-foreground">de {data.users_total} totales</span>
          </CardContent>
        </DashboardCard>

        <DashboardCard className="py-5">
          <CardContent className="flex flex-col gap-1 px-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Usuarios Free</p>
            <h3 className="text-2xl font-semibold">{data.users_free}</h3>
            <span className="text-sm text-muted-foreground">{data.users_total > 0 ? Math.round(data.users_free / data.users_total * 100) : 0}% del total</span>
          </CardContent>
        </DashboardCard>

        <DashboardCard className="py-5">
          <CardContent className="flex flex-col gap-1 px-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Próximos a vencer</p>
            <h3 className="text-2xl font-semibold">{data.expiring_soon.length}</h3>
            <span className="text-sm text-muted-foreground">en los próximos 7 días</span>
          </CardContent>
        </DashboardCard>
      </div>

      {/* Revenue by type */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(data.by_type).map(([type, info]) => (
          <DashboardCard key={type} className="flex flex-col gap-0!">
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Dumbbell size={16} className="text-muted-foreground" />
                {type}
              </h3>
            </div>
            <CardContent className="p-5 flex gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Ventas</span>
                <span className="text-xl font-semibold">{info.count}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Ingresos</span>
                <span className="text-xl font-semibold text-chart-2">{fmtEur(info.revenue_cents)}</span>
              </div>
            </CardContent>
          </DashboardCard>
        ))}
      </div>

      {/* Expiring soon */}
      {data.expiring_soon.length > 0 && (
        <DashboardCard className="flex flex-col gap-0!">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock size={16} className="text-muted-foreground" />
              Próximos a vencer (7 días)
            </h3>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Cliente</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Plan</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Vence</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Días</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expiring_soon.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2.5">{item.subscriber_name}</td>
                      <td className="px-4 py-2.5">{item.plan_name}</td>
                      <td className="px-4 py-2.5">{item.ends_at ? format(new Date(item.ends_at), 'dd MMM', { locale: es }) : '—'}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={item.days_left <= 3 ? 'destructive' : 'secondary'}>{item.days_left} días</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </DashboardCard>
      )}
    </div>
  )
}
