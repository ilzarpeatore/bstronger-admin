import { BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { DashboardCard } from '@/components/shared/dashboard-card'

type BarPoint = { label: string; value: number }

const chartConfig = {
  value: { label: 'Total', color: 'var(--color-primary)' },
} satisfies ChartConfig

export default function KpisBarChart({ title, data }: { title: string; data: BarPoint[] }) {
  return (
    <DashboardCard className="flex flex-col gap-0!">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 size={16} className="text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <ChartContainer config={chartConfig} className="h-[215px]! w-full">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
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
  )
}
