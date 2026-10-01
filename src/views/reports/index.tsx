import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, subMonths } from 'date-fns'
import { es } from 'date-fns/locale/es'
import {
  Download, CalendarDays, Users, Dumbbell, CreditCard, MessageSquare, Wallet,
  BarChart3, Table, ClipboardCheck,
} from 'lucide-react'
import SubscriptionPaymentTracking from './subscription-payment-tracking'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CardContent } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'
import {
  ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

type SummaryRow = { label: string; value: number }
type SummaryPayload = { period_label: string; data: SummaryRow[]; total: number }

type ReportType = 'users' | 'sessions' | 'subscriptions' | 'payments' | 'checkins' | 'payment-tracking'

const reportTabs: { value: ReportType; label: string; icon: typeof Users }[] = [
  { value: 'users', label: 'Usuarios', icon: Users },
  { value: 'sessions', label: 'Sesiones', icon: Dumbbell },
  { value: 'subscriptions', label: 'Suscripciones', icon: CreditCard },
  { value: 'payments', label: 'Pagos', icon: Wallet },
  { value: 'checkins', label: 'Check-ins', icon: MessageSquare },
  { value: 'payment-tracking', label: 'Seguimiento de pagos', icon: ClipboardCheck },
]

const chartConfig = {
  value: { label: 'Total', color: 'var(--color-primary)' },
} satisfies ChartConfig

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(String(r[h] ?? ''))).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsView() {
  const today = new Date()
  const defaultFrom = subMonths(today, 1)

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ from: defaultFrom, to: today })
  const [coachFilter, setCoachFilter] = useState<string>('all')
  const [coaches, setCoaches] = useState<{ id: number; name: string }[]>([])
  const [groupBy, setGroupBy] = useState<string>('month')
  const [activeTab, setActiveTab] = useState<ReportType>('users')
  const [data, setData] = useState<SummaryPayload | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  // FIX (auditoría 2026-09-13): "Gimnasio" y "Programa" eran filtros de la
  // plantilla original (nombres inventados) sin aplicación
  // en este negocio (servicio presencial 1:1, no cadena de gimnasios) --
  // quitados. "Coach" ahora carga la lista real (mismo endpoint que
  // CoachExceptionsView) y el backend sí filtra por coach_id.
  useEffect(() => {
    api.get('/admin/coach-exceptions/coaches').then(res => setCoaches(res.data || [])).catch(() => {})
  }, [])

  const queryParams = useMemo(() => {
    const p = new URLSearchParams()
    p.set('from', format(dateRange.from, 'yyyy-MM-dd'))
    p.set('to', format(dateRange.to, 'yyyy-MM-dd'))
    p.set('group_by', groupBy)
    if (coachFilter !== 'all') p.set('coach_id', coachFilter)
    return p.toString()
  }, [dateRange, coachFilter, groupBy])

  const fetchReport = useCallback(async () => {
    if (activeTab === 'payment-tracking') return
    setLoading(true)
    try {
      const endpoint =
        activeTab === 'payments' ? '/admin/reports/payments'
        : `/admin/reports/${activeTab}`
      const res = await api.get(`${endpoint}?${queryParams}`)
      setData(res.data)
      setRows(res.data?.rows ?? [])
    } catch {
      setData(null)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, queryParams])

  useEffect(() => { fetchReport() }, [fetchReport])

  const handleExport = () => {
    const fromStr = format(dateRange.from, 'yyyyMMdd')
    const toStr = format(dateRange.to, 'yyyyMMdd')
    exportCsv(rows, `informe-${activeTab}-${fromStr}-${toStr}.csv`)
  }

  const handleDownloadCsv = () => {
    const type = activeTab
    const from = format(dateRange.from, 'yyyy-MM-dd')
    const to = format(dateRange.to, 'yyyy-MM-dd')
    window.open(`/admin/reports/export?format=csv&type=${type}&from=${from}&to=${to}`, '_blank')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center flex-wrap gap-4 justify-between">
        <div>
          <h2 className="text-xl font-semibold">Informes</h2>
          <p className="text-sm text-muted-foreground">Análisis detallado de usuarios, sesiones, suscripciones y pagos</p>
        </div>
        {activeTab !== 'payment-tracking' && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger render={
                <Button variant="outline" className="gap-2 cursor-pointer">
                  <CalendarDays size={16} />
                  <span>
                    {format(dateRange.from, 'dd MMM yy', { locale: es })} - {format(dateRange.to, 'dd MMM yy', { locale: es })}
                  </span>
                </Button>
              } />
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to })
                    }
                  }}
                  locale={es}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <Button variant="outline" onClick={handleExport} className="gap-2 cursor-pointer">
              <Download size={16} />
              CSV
            </Button>
          </div>
        )}
      </div>

      {activeTab !== 'payment-tracking' && (
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={coachFilter} onValueChange={(v) => v && setCoachFilter(v)}>
            <SelectTrigger className="w-[180px] cursor-pointer">
              <SelectValue placeholder="Coach" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los coaches</SelectItem>
              {coaches.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={(v) => v && setGroupBy(v)}>
            <SelectTrigger className="w-[140px] cursor-pointer">
              <SelectValue placeholder="Agrupar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Por mes</SelectItem>
              <SelectItem value="day">Por día</SelectItem>
              <SelectItem value="plan">Por plan</SelectItem>
              <SelectItem value="type">Por tipo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)}>
        <TabsList>
          {reportTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 cursor-pointer">
              <tab.icon size={14} />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {reportTabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4 flex flex-col gap-4">
            {tab.value === 'payment-tracking' ? (
              <SubscriptionPaymentTracking />
            ) : loading ? (
              <div className="h-[300px] rounded-none bg-muted/50 animate-pulse flex items-center justify-center">
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : data ? (
              <>
                <SummaryCard
                  total={data.total}
                  periodLabel={data.period_label}
                  totalLabel={
                    tab.value === 'sessions' ? 'sesiones' :
                    tab.value === 'payments' ? 'ingresos totales' :
                    tab.value === 'subscriptions' ? 'suscripciones' :
                    tab.value === 'checkins' ? 'check-ins' : 'usuarios'
                  }
                />
                <DashboardCard className="flex flex-col gap-0!">
                  <div className="border-b border-border px-5 py-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 size={16} className="text-muted-foreground" />
                      Distribución {data.period_label}
                    </h3>
                  </div>
                  <CardContent className="p-5">
                    <ChartContainer config={chartConfig} className="h-[280px]! w-full">
                      <BarChart data={data.data} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                        />
                        <YAxis tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                        <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.3 }} content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={700} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </DashboardCard>

                {rows.length > 0 && (
                  <DashboardCard className="flex flex-col gap-0!">
                    <div className="border-b border-border px-5 py-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Table size={16} className="text-muted-foreground" />
                        Datos ({rows.length} registros)
                      </h3>
                      <Button variant="outline" size="sm" onClick={handleDownloadCsv} className="cursor-pointer gap-1.5">
                        <Download size={14} />
                        Exportar
                      </Button>
                    </div>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/50">
                              {Object.keys(rows[0] || {}).map((key) => (
                                <th key={key} className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                                  {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                {Object.values(row).map((val, j) => (
                                  <td key={j} className="px-4 py-2.5 whitespace-nowrap">{String(val ?? '-')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </DashboardCard>
                )}
              </>
            ) : (
              <div className="h-64 flex items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">No hay datos para el período seleccionado</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function SummaryCard({ total, totalLabel, periodLabel }: {
  total: number
  totalLabel: string
  periodLabel: string
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <DashboardCard className="py-5">
        <CardContent className="flex flex-col gap-1 px-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total {totalLabel}</p>
          <h3 className="text-2xl font-semibold">{total.toLocaleString()}</h3>
          <p className="text-xs text-muted-foreground">Agrupado {periodLabel}</p>
        </CardContent>
      </DashboardCard>
    </div>
  )
}
