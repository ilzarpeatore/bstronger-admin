import { TrendingUp } from 'lucide-react'
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type ChartPoint = { period: string; plan_count: number; amount: number }

const filterOptions: { value: string; label: string }[] = [
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'year', label: 'Este año' },
]

const chartConfig = {
  amount: { label: 'Ingresos', color: 'var(--color-primary)' },
  plan_count: { label: 'Suscripciones', color: 'color-mix(in srgb, var(--primary) 60%, transparent)' },
} satisfies ChartConfig

export default function RevenueChart({
  data,
  filter,
  onFilterChange,
  total,
}: {
  data: ChartPoint[]
  filter: string
  onFilterChange: (v: string) => void
  total: { total: number; amount: number }
}) {
  return (
    <DashboardCard className='flex flex-col gap-0!'>
      <CardHeader className='border-b border-border'>
        <CardTitle className='flex items-center gap-2'>
          <TrendingUp size={16} className='text-muted-foreground' />
          Ingresos por suscripciones
        </CardTitle>
      </CardHeader>

      <CardContent className='p-5 flex flex-col gap-6'>
        <div className='flex items-start justify-between gap-4 flex-wrap'>
          <div className='flex flex-col gap-1'>
            <span className='text-base font-normal text-foreground leading-6'>Ingresos totales</span>
            <div className='flex items-center gap-2 flex-wrap'>
              <span className='text-2xl font-semibold tracking-[-0.3px] text-foreground leading-8'>
                ${total.amount.toLocaleString()}
              </span>
              <span className='text-sm font-normal text-muted-foreground'>{total.total} suscripciones</span>
            </div>
          </div>

          <Select value={filter} onValueChange={(v) => v && onFilterChange(v)}>
            <SelectTrigger className='h-auto! w-fit text-sm font-medium text-foreground border-border shadow-[0px_1px_2px_rgba(0,0,0,0.05)] cursor-pointer gap-1.5 px-3'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className='cursor-pointer'>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {data.length === 0 ? (
          <div className='h-[215px] flex items-center justify-center text-sm text-muted-foreground'>
            No hay suscripciones en este período
          </div>
        ) : (
          <ChartContainer config={chartConfig} className='h-[215px]! w-full'>
            <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid vertical={false} stroke='var(--border)' strokeDasharray='4 4' />
              <XAxis
                dataKey='period'
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
              <ChartTooltip
                cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={<ChartTooltipContent />}
              />
              <Line
                dataKey='amount'
                type='linear'
                stroke='var(--color-primary)'
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--color-primary)', strokeWidth: 0 }}
                isAnimationActive
                animationDuration={700}
                animationEasing='ease-out'
              />
              <Line
                dataKey='plan_count'
                type='linear'
                stroke='color-mix(in srgb, var(--primary) 60%, transparent)'
                strokeWidth={1.5}
                strokeDasharray='4 4'
                dot={false}
                activeDot={{ r: 4, fill: 'color-mix(in srgb, var(--primary) 60%, transparent)', strokeWidth: 0 }}
                isAnimationActive
                animationDuration={700}
                animationEasing='ease-out'
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </DashboardCard>
  )
}
