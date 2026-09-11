import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type HistoryPoint = { index: number; date: string; weight: number; one_rm: number }

export default function ExerciseHistoryChart({ data }: { data: HistoryPoint[] }) {
  return (
    <div className='h-[220px]'>
      <ResponsiveContainer width='100%' height='100%'>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          <XAxis dataKey='index' tick={{ fontSize: 10 }} label={{ value: 'Serie #', position: 'insideBottom', offset: -5, fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip
            labelFormatter={(_, payload) => {
              const d = payload?.[0]?.payload?.date
              return d ? new Date(String(d)).toLocaleDateString('es-ES') : ''
            }}
            formatter={(value, name) => [`${value} kg`, name === 'weight' ? 'Peso' : '1RM']}
          />
          <Line type='monotone' dataKey='weight' stroke='#000000' strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name='weight' />
          <Line type='monotone' dataKey='one_rm' stroke='#94a3b8' strokeWidth={2} strokeDasharray='4 3' dot={{ r: 2 }} name='one_rm' />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
