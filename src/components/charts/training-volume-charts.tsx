import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
  Line,
  LineChart,
} from 'recharts'
import { useEffect, useRef, useState } from 'react'
import { BodyChart, ViewSide, type BodyState } from 'body-muscles'
import { bodyMusclesIdsFor } from '@/lib/body-muscles-map'

const PALETTE = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#14b8a6',
  '#6366f1',
  '#f43f5e',
  '#94a3b8',
]

export function TotalVolumeChart({ data }: { data: { date: string; volume: number }[] }) {
  return (
    <div className='h-[280px]'>
      <ResponsiveContainer width='100%' height='100%'>
        <AreaChart data={data}>
          <defs>
            <linearGradient id='volumeFill' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='5%' stopColor='#2563eb' stopOpacity={0.35} />
              <stop offset='95%' stopColor='#2563eb' stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          <XAxis
            dataKey='date'
            tick={{ fontSize: 10 }}
            tickFormatter={v => new Date(String(v)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          />
          <YAxis tick={{ fontSize: 10 }} width={50} />
          <Tooltip
            labelFormatter={v => new Date(String(v)).toLocaleDateString('es-ES')}
            formatter={value => [`${Number(value).toLocaleString('es-ES')} kg`, 'Volumen']}
          />
          <Area type='monotone' dataKey='volume' stroke='#2563eb' strokeWidth={2} fill='url(#volumeFill)' dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MuscleVolumeChart({ data }: { data: { group: string; volume: number }[] }) {
  return (
    <div className='h-[280px]'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={data} layout='vertical' margin={{ left: 8, right: 24 }}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' horizontal={false} />
          <XAxis type='number' tick={{ fontSize: 10 }} />
          <YAxis
            type='category'
            dataKey='group'
            width={110}
            tick={{ fontSize: 11 }}
            tickFormatter={v => String(v).replace(/\s+/g, ' ')}
          />
          <Tooltip formatter={value => [`${Number(value).toLocaleString('es-ES')} kg`, 'Volumen']} />
          <Bar dataKey='volume' fill='#16a34a' radius={[0, 4, 4, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MuscleVolumeOverTimeChart({ data }: { data: { date: string; volume: number }[] }) {
  return (
    <div className='h-[220px]'>
      <ResponsiveContainer width='100%' height='100%'>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          <XAxis
            dataKey='date'
            tick={{ fontSize: 10 }}
            tickFormatter={v => new Date(String(v)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          />
          <YAxis tick={{ fontSize: 10 }} width={45} />
          <Tooltip
            labelFormatter={v => new Date(String(v)).toLocaleDateString('es-ES')}
            formatter={value => [`${Number(value).toLocaleString('es-ES')} kg`, 'Volumen']}
          />
          <Line type='monotone' dataKey='volume' stroke='#16a34a' strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MuscleVolumeCompareChart({ data, groups }: { data: Record<string, any>[]; groups: string[] }) {
  return (
    <div className='h-[300px]'>
      <ResponsiveContainer width='100%' height='100%'>
        <LineChart data={data} margin={{ top: 8 }}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          <XAxis
            dataKey='date'
            tick={{ fontSize: 10 }}
            tickFormatter={v => new Date(String(v)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          />
          <YAxis tick={{ fontSize: 10 }} width={50} />
          <Tooltip
            labelFormatter={v => new Date(String(v)).toLocaleDateString('es-ES')}
            formatter={value => [`${Number(value).toLocaleString('es-ES')} kg`, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {groups.map((g, i) => (
            <Line
              key={g}
              type='monotone'
              dataKey={g}
              name={g.charAt(0).toUpperCase() + g.slice(1)}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MuscleVolumeStackedChart({ data, groups }: { data: Record<string, any>[]; groups: string[] }) {
  return (
    <div className='h-[300px]'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={data} margin={{ top: 8 }}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' vertical={false} />
          <XAxis
            dataKey='date'
            tick={{ fontSize: 10 }}
            tickFormatter={v => new Date(String(v)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
          />
          <YAxis tick={{ fontSize: 10 }} width={50} />
          <Tooltip
            labelFormatter={v => new Date(String(v)).toLocaleDateString('es-ES')}
            formatter={value => [`${Number(value).toLocaleString('es-ES')} kg`, undefined]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {groups.map((g, i) => (
            <Bar
              key={g}
              dataKey={g}
              stackId='volume'
              fill={PALETTE[i % PALETTE.length]}
              name={g.charAt(0).toUpperCase() + g.slice(1)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Heatmap anatomico del volumen por grupo muscular, usando `body-muscles`
 * (npm, Apache 2.0). Normaliza cada grupo a una intensidad 0-10 relativa al
 * volumen maximo del propio conjunto de datos (no absoluta) — el grupo mas
 * trabajado siempre se ve en rojo intenso, sea cual sea el kg real.
 */
export function MuscleBodyHeatmap({ data }: { data: { group: string; volume: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<BodyChart | null>(null)
  const [view, setView] = useState<ViewSide>(ViewSide.FRONT)

  const bodyState: BodyState = {}
  const maxVolume = Math.max(1, ...data.map(d => d.volume))
  for (const { group, volume } of data) {
    if (volume <= 0) continue
    const intensity = Math.max(1, Math.min(10, Math.round((volume / maxVolume) * 10)))
    for (const muscleId of bodyMusclesIdsFor(group)) {
      bodyState[muscleId] = { intensity, selected: false }
    }
  }

  useEffect(() => {
    if (!containerRef.current) return
    chartRef.current = new BodyChart(containerRef.current, {
      view,
      bodyState,
      showViewLabel: false,
    })
    return () => chartRef.current?.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chartRef.current?.update({ view, bodyState })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, JSON.stringify(bodyState)])

  return (
    <div className='flex flex-col items-center gap-3'>
      <div className='flex rounded-lg border bg-background p-1 w-fit'>
        <button
          type='button'
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === ViewSide.FRONT ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          onClick={() => setView(ViewSide.FRONT)}
        >
          Frontal
        </button>
        <button
          type='button'
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${view === ViewSide.BACK ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          onClick={() => setView(ViewSide.BACK)}
        >
          Trasera
        </button>
      </div>
      <div ref={containerRef} className='w-full max-w-[240px]' />
    </div>
  )
}
