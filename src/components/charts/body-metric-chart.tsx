import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type BodyMetricPoint = { value: number; date: string; notes: string | null }

type BodyMetricChartProps = {
  data: BodyMetricPoint[]
  height?: number
  yAxisWidth?: number
}

export default function BodyMetricChart({ data, height = 200, yAxisWidth = 40 }: BodyMetricChartProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width='100%' height='100%'>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          <XAxis dataKey='date' tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(String(v)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
          <YAxis tick={{ fontSize: 10 }} width={yAxisWidth} />
          <Tooltip labelFormatter={(v) => new Date(String(v)).toLocaleDateString()} />
          <Line type='monotone' dataKey='value' stroke='#000000' strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
