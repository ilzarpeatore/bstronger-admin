import { useState } from 'react'
import { FlameIcon, ChevronDownIcon, MoreVerticalIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { habitIconFor } from '@/lib/habitIcons'
import { habitProgressRatio, habitCellColor } from '@/lib/habitColor'

export type HabitProgressLog = { date: string; is_completed: boolean; value_logged?: number | string | null }

export type HabitProgressItem = {
  id: number
  title: string
  icon: string | null
  target_value: number | string | null
  target_unit: string | null
  frequency: 'daily' | 'weekly'
  source_type?: 'coach_assigned' | 'library' | 'personal' | null
  source_template_title?: string | null
  current_streak?: number
  completion_count?: number
  days_tracked?: number
  logs?: HabitProgressLog[]
}

function formatGoal(item: HabitProgressItem) {
  if (!item.target_value || !item.target_unit) return null
  return `${item.target_value} ${item.target_unit} / ${item.frequency === 'daily' ? 'día' : 'semana'}`
}

const SOURCE_LABEL: Record<string, string> = {
  coach_assigned: 'Asignado por ti',
  library: 'De la biblioteca',
  personal: 'Personal del cliente',
}
const SOURCE_COLOR: Record<string, string> = {
  coach_assigned: 'bg-violet-50 text-violet-700 border-violet-200',
  library: 'bg-sky-50 text-sky-700 border-sky-200',
  personal: 'bg-amber-50 text-amber-700 border-amber-200',
}

type Period = 'week' | 'month' | 'quarter' | 'half' | 'year'
const PERIODS: { key: Period; label: string; cols: number }[] = [
  { key: 'week', label: 'Semana', cols: 7 },
  { key: 'month', label: 'Mes', cols: 10 },
  { key: 'quarter', label: 'Trimestre', cols: 15 },
  { key: 'half', label: 'Semestre', cols: 20 },
  { key: 'year', label: 'Año', cols: 30 },
]
const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function toIso(d: Date) { return d.toISOString().slice(0, 10) }
function startOfDay(d: Date) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c }
/** Lunes = 0 ... Domingo = 6 (Date#getDay() empieza en domingo). */
function mondayIndex(d: Date) { return (d.getDay() + 6) % 7 }

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

function startOfQuarter(d: Date) {
  const month = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), month, 1)
}
function endOfQuarter(d: Date) {
  const month = Math.floor(d.getMonth() / 3) * 3 + 2
  return new Date(d.getFullYear(), month + 1, 0)
}

function startOfHalfYear(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1)
}
function endOfHalfYear(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() < 6 ? 6 : 12, 0)
}

function startOfYear(d: Date) { return new Date(d.getFullYear(), 0, 1) }
function endOfYear(d: Date) { return new Date(d.getFullYear(), 11, 31) }

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const current = startOfDay(start)
  const last = startOfDay(end)
  for (let d = new Date(current); d <= last; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d))
  }
  return days
}

function periodRange(period: Period, today: Date): [Date, Date] {
  switch (period) {
    case 'week': {
      const monday = addDays(today, -mondayIndex(today))
      return [monday, addDays(monday, 6)]
    }
    case 'month': return [startOfMonth(today), endOfMonth(today)]
    case 'quarter': return [startOfQuarter(today), endOfQuarter(today)]
    case 'half': return [startOfHalfYear(today), endOfHalfYear(today)]
    case 'year': return [startOfYear(today), endOfYear(today)]
  }
}

function HabitHeatmap({ logs, period, targetValue }: { logs: HabitProgressLog[]; period: Period; targetValue?: number | string | null }) {
  const cfg = PERIODS.find(p => p.key === period)!
  const today = startOfDay(new Date())
  const logMap = new Map(logs.map(l => [l.date.slice(0, 10), l]))
  const [start, end] = periodRange(period, today)
  const days = eachDay(start, end)
  const trackedDays = days.filter(d => d <= today)
  const completed = trackedDays.filter(d => !!logMap.get(toIso(d))?.is_completed).length

  // Color por % de cumplimiento (mismo degradado que en la app, ver
  // src/lib/habitColor.ts) en vez de solo hecho/no-hecho — para hábitos
  // binarios (sin target_value) ratio siempre da null y se pinta como antes.
  const cellColor = (d: Date): { className: string; style?: { backgroundColor: string } } => {
    if (d > today) return { className: 'bg-muted/50' }
    const log = logMap.get(toIso(d))
    const ratio = habitProgressRatio(log?.value_logged, targetValue)
    const color = habitCellColor(ratio, !!log?.is_completed)
    return color ? { className: '', style: { backgroundColor: color } } : { className: 'bg-muted' }
  }

  if (period === 'week') {
    return (
      <div>
        <p className="text-xs text-muted-foreground mb-2">{completed}/{trackedDays.length} días completados esta semana</p>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            const iso = toIso(d)
            const { className, style } = cellColor(d)
            return (
              <div key={iso} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{WEEKDAY_LABELS[i]}</span>
                <div title={iso} className={cn('w-full aspect-square rounded-md', className)} style={style} />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Mes/trimestre/semestre/año se dibujan como cuadrículas compactas con un
  // número fijo de columnas para evitar scroll horizontal. Los días futuros
  // del periodo en curso aparecen grisados.
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">{completed}/{trackedDays.length} días completados en este periodo</p>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}
      >
        {days.map(d => {
          const iso = toIso(d)
          const log = logMap.get(iso)
          const { className, style } = cellColor(d)
          return (
            <div
              key={iso}
              title={`${iso}${log?.is_completed ? ' — completado' : ''}`}
              className={cn('w-full aspect-square rounded-[2px]', className)}
              style={style}
            />
          )
        })}
      </div>
    </div>
  )
}

function HabitProgressRow({ item, onEdit, onDelete }: { item: HabitProgressItem; onEdit?: (item: HabitProgressItem) => void; onDelete?: (item: HabitProgressItem) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [period, setPeriod] = useState<Period>('week')
  const Icon = habitIconFor(item.icon)
  const rate = item.days_tracked ? Math.round(((item.completion_count ?? 0) / item.days_tracked) * 100) : 0
  const goal = formatGoal(item)

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
        <button type="button" className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setExpanded(v => !v)}>
          <Icon className="size-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-sm shrink-0">{item.title}</span>
          {goal && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50 text-[10px] shrink-0">{goal}</Badge>}
          {item.source_type && (
            <Badge variant="outline" className={cn('text-[10px] shrink-0', SOURCE_COLOR[item.source_type])}>
              {item.source_type === 'library' && item.source_template_title ? `Biblioteca: ${item.source_template_title}` : SOURCE_LABEL[item.source_type]}
            </Badge>
          )}
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <button type="button" className="flex items-center gap-3 text-xs text-muted-foreground" onClick={() => setExpanded(v => !v)}>
            {!!item.current_streak && <span className="flex items-center gap-1 font-medium text-orange-600"><FlameIcon className="size-3.5" />{item.current_streak}d racha</span>}
            {item.days_tracked != null && <span>{item.completion_count}/{item.days_tracked} días · {rate}%</span>}
            <ChevronDownIcon className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
          </button>
          {(onEdit || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger><Button variant="ghost" size="icon" className="size-7"><MoreVerticalIcon className="size-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && <DropdownMenuItem onClick={() => onEdit(item)}>Editar</DropdownMenuItem>}
                {onDelete && <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive">Eliminar</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-3 bg-muted/20">
          <div className="flex rounded-lg border bg-background p-1 mb-3 w-fit">
            {PERIODS.map(p => (
              <button
                key={p.key}
                type="button"
                className={cn('px-3 py-1 text-xs font-medium rounded-md transition-all', period === p.key ? 'bg-violet-600 text-white' : 'text-muted-foreground hover:bg-muted')}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <HabitHeatmap logs={item.logs || []} period={period} targetValue={item.target_value} />
        </div>
      )}
    </div>
  )
}

/**
 * Progreso real de los hábitos de un cliente — click en un hábito para
 * expandir y ver su historial por periodo (semana/mes/trimestre/semestre/año).
 * Usado en HabitsView.tsx (al seleccionar cliente) y en UserDetailView.tsx
 * (pestaña Hábitos del perfil de cliente) — misma vista en ambos sitios.
 */
type Props = {
  items: HabitProgressItem[]
  loading: boolean
  emptyLabel: string
  onEdit?: (item: HabitProgressItem) => void
  onDelete?: (item: HabitProgressItem) => void
}

export default function HabitProgressPanel({ items, loading, emptyLabel, onEdit, onDelete }: Props) {
  if (loading) {
    return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">{emptyLabel}</p>
  }
  return (
    <div className="space-y-3">
      {items.map(item => <HabitProgressRow key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />)}
    </div>
  )
}
