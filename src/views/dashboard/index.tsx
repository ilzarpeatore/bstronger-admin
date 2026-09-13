import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  UsersIcon,
  DumbbellIcon,
  AppleIcon,
  UtensilsCrossedIcon,
  ActivityIcon,
  RefreshCcw,
  Sun,
  Moon,
} from 'lucide-react'
import StatCard from '@/components/dashboard/StatCard'
import LibraryBreakdown from '@/components/dashboard/LibraryBreakdown'
import RecentActivity from '@/components/dashboard/RecentActivity'
import CoachExceptionsCard from '@/components/dashboard/CoachExceptionsCard'
import { DashboardSkeleton } from '@/components/shared/skeletons'
import type { DashboardKpis } from '@/components/dashboard/KpiSection'
import CoachingMetricsCard, { type CoachMetric } from '@/components/dashboard/CoachingMetricsCard'

const KpiSection = lazy(() => import('@/components/dashboard/KpiSection'))
const RevenueChart = lazy(() => import('@/components/dashboard/RevenueChart'))
const ContentBarChart = lazy(() => import('@/components/dashboard/ContentBarChart'))

type ChartPoint = { period: string; plan_count: number; amount: number }

type DashboardData = {
  total_users: number
  total_equipment: number
  total_levels: number
  total_workout_types: number
  total_exercises: number
  total_workouts: number
  total_diets: number
  total_posts: number
  total_products: number
  total_recipes: number
  total_ingredients: number
  total_recipe_categories: number
  total_recipe_tags: number
  subscription: { total: number; amount: number; recent: any[]; expiring: any[] } | null
  charts: ChartPoint[] | null
  recent_exercise: any[]
  recent_workout: any[]
  recent_diet: any[]
  recent_post: any[]
}

type CoachingData = {
  metrics: CoachMetric[]
  totals: { total_clientes: number; clientes_activos: number; pct_con_plan_promedio: number }
}

function useGreeting() {
  const [greeting, setGreeting] = useState('')
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 12) setGreeting('Buenos días')
    else if (hour >= 12 && hour < 17) setGreeting('Buenas tardes')
    else if (hour >= 17 && hour < 21) setGreeting('Buenas noches')
    else setGreeting('Buenas noches')
  }, [])
  return greeting
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [coaching, setCoaching] = useState<CoachingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [kpisLoading, setKpisLoading] = useState(true)
  const [filter, setFilter] = useState('week')
  const greeting = useGreeting()

  const kpiPeriod = filter === 'year' ? 'month' : filter

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/admin/dashboard?filter=${filter}`)
      setData(res.data)
    } catch {
      /* keep previous data on failure */
    } finally {
      setLoading(false)
    }
  }, [filter])

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true)
    try {
      const res = await api.get(`/admin/reports/dashboard-kpis?period=${kpiPeriod}`)
      setKpis(res.data)
    } catch {
      /* ignore */
    } finally {
      setKpisLoading(false)
    }
  }, [kpiPeriod])

  const fetchCoaching = useCallback(async () => {
    try {
      const res = await api.get('/admin/reports/coaching-metrics')
      setCoaching(res.data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchKpis() }, [fetchKpis])
  useEffect(() => { fetchCoaching() }, [fetchCoaching])

  const contentTotals = useMemo(() => {
    if (!data) return []
    return [
      { label: 'Entrenamientos', value: data.total_workouts },
      { label: 'Dietas', value: data.total_diets },
      { label: 'Recetas', value: data.total_recipes },
      { label: 'Ejercicios', value: data.total_exercises },
      { label: 'Entradas', value: data.total_posts },
      { label: 'Productos', value: data.total_products },
    ]
  }, [data])

  const libraryItems = useMemo(() => {
    if (!data) return []
    return [
      { id: 'equipment', title: 'Equipo', value: data.total_equipment, icon: DumbbellIcon },
      { id: 'levels', title: 'Niveles', value: data.total_levels, icon: ActivityIcon },
      { id: 'workout_types', title: 'Tipos de entrenamiento', value: data.total_workout_types, icon: DumbbellIcon },
      { id: 'recipe_categories', title: 'Categorías de recetas', value: data.total_recipe_categories, icon: UtensilsCrossedIcon },
      { id: 'recipe_tags', title: 'Etiquetas de recetas', value: data.total_recipe_tags, icon: UtensilsCrossedIcon },
      { id: 'products', title: 'Productos', value: data.total_products, icon: AppleIcon },
    ]
  }, [data])

  if (loading && !data) {
    return <DashboardSkeleton />
  }

  if (!data) return null

  return (
    <div className='flex flex-col gap-4'>
      {/* Header */}
      <div className='flex items-center flex-wrap lg:flex-nowrap gap-4 justify-between'>
        <div className='flex flex-col items-start'>
          <h2 className='text-xl flex items-center gap-2'>
            {greeting}
            {greeting === 'Buenos días' || greeting === 'Buenas tardes' ? (
              <Sun size={20} className='text-orange-400' />
            ) : (
              <Moon size={20} />
            )}
          </h2>
          <p className='text-sm font-normal text-muted-foreground'>Mantente informado con la actividad de tu plataforma</p>
        </div>
        <Button variant='outline' onClick={fetchData} disabled={loading} className='p-2.5 h-auto rounded-lg cursor-pointer'>
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Hero stats */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <StatCard title='Total de usuarios' value={data.total_users} icon={UsersIcon} />
        <StatCard title='Total de entrenamientos' value={data.total_workouts} icon={DumbbellIcon} />
        <StatCard title='Total de recetas' value={data.total_recipes} icon={UtensilsCrossedIcon} />
        <StatCard title='Total de ejercicios' value={data.total_exercises} icon={ActivityIcon} />
      </div>

      {/* KPIs por período + comparativa */}
      <div className='flex flex-col gap-4'>
        <h3 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
          KPIs del período — comparativa {kpiPeriod === 'week' ? 'semanal' : 'mensual'}
        </h3>
        <Suspense fallback={<div className='h-24 flex items-center justify-center rounded-lg border border-dashed'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>}>
          <KpiSection kpis={kpis} loading={kpisLoading} />
        </Suspense>
      </div>

      {/* Main chart + library breakdown */}
      <div className='grid gap-4 lg:grid-cols-12'>
        <div className='lg:col-span-7 col-span-12'>
          <Suspense fallback={<div className='h-64 flex items-center justify-center rounded-lg border border-dashed'><div className='h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>}>
            {data.charts ? (
              <RevenueChart
                data={data.charts}
                filter={filter}
                onFilterChange={setFilter}
                total={{ total: data.subscription?.total ?? 0, amount: data.subscription?.amount ?? 0 }}
              />
            ) : (
              <ContentBarChart data={contentTotals} />
            )}
          </Suspense>
        </div>
        <div className='lg:col-span-5 col-span-12 flex flex-col gap-4'>
          <LibraryBreakdown items={libraryItems} />
          {coaching && (
            <CoachingMetricsCard metrics={coaching.metrics} totals={coaching.totals} />
          )}
        </div>
      </div>

      {/* Excepciones pendientes del Motor de Auto-Regulación */}
      <CoachExceptionsCard variant='dashboard' />

      {/* Recent activity */}
      <RecentActivity
        workouts={data.recent_workout}
        diets={data.recent_diet}
        posts={data.recent_post}
        exercises={data.recent_exercise}
      />
    </div>
  )
}
