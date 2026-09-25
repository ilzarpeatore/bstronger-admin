import { useMemo, useState, type DragEventHandler, type MouseEventHandler, type ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CAL_MONTH_NAMES,
  CAL_WEEKDAYS,
  formatWeekRange,
  getMonthWeeks,
  getTodayStr,
  weekIndexOfDay,
} from '@/lib/calendarGrid'

// ÚNICO calendario del panel. Lo usan la pestaña Entrenamiento y Nutrición de
// la ficha del cliente, /client-calendar y /client-meal-calendar. Cualquier
// cambio de aspecto o de navegación (barra Hoy/‹ ›, vista Semana/Mes, celdas,
// día actual...) se hace AQUÍ y se propaga a todos. Cada vista solo aporta el
// contenido de cada día (`renderDay`) y sus acciones.

export type CalendarDayContext = {
  date: string
  isToday: boolean
  weekIndex: number
  dayIndex: number
}

export type CalendarDayProps = {
  className?: string
  onClick?: MouseEventHandler<HTMLDivElement>
  onDragOver?: DragEventHandler<HTMLDivElement>
  onDrop?: DragEventHandler<HTMLDivElement>
}

type Props = {
  year: number
  month: number
  /** Se llama al navegar a otro mes (con los botones, "Hoy" o cruzando semana en vista Semana). */
  onMonthChange: (year: number, month: number) => void
  loading?: boolean
  /** false → se muestra `emptyState` en vez de la cuadrícula. */
  hasData?: boolean
  emptyState?: ReactNode
  legend?: ReactNode
  renderDay: (ctx: CalendarDayContext) => ReactNode
  /** Contenido extra a la derecha del número de día (p. ej. acciones de semana). */
  dayHeaderExtra?: (ctx: CalendarDayContext) => ReactNode
  dayProps?: (ctx: CalendarDayContext) => CalendarDayProps
}

export function MonthWeekCalendar({
  year, month, onMonthChange, loading = false, hasData = true, emptyState, legend, renderDay, dayHeaderExtra, dayProps,
}: Props) {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [weekIndexState, setWeekIndex] = useState(0)
  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month])
  const weekIndex = Math.min(weekIndexState, weeks.length - 1)
  const today = getTodayStr()

  const goToToday = () => {
    const n = new Date()
    onMonthChange(n.getFullYear(), n.getMonth() + 1)
    setWeekIndex(weekIndexOfDay(n.getFullYear(), n.getMonth() + 1, n.getDate()))
  }

  const prev = () => {
    if (viewMode === 'week') {
      if (weekIndex > 0) { setWeekIndex(weekIndex - 1); return }
      const pm = month === 1 ? 12 : month - 1
      const py = month === 1 ? year - 1 : year
      onMonthChange(py, pm)
      setWeekIndex(getMonthWeeks(py, pm).length - 1)
      return
    }
    onMonthChange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)
  }

  const next = () => {
    if (viewMode === 'week') {
      if (weekIndex < weeks.length - 1) { setWeekIndex(weekIndex + 1); return }
      onMonthChange(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)
      setWeekIndex(0)
      return
    }
    onMonthChange(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)
  }

  const renderCell = (dateStr: string | null, wi: number, di: number) => {
    if (!dateStr) {
      return (
        <div key={`${wi}-${di}`} className='p-2 min-h-[150px] flex flex-col bg-muted/30'>
          <p className='text-[11px] font-medium text-muted-foreground/50 mb-2'>—</p>
        </div>
      )
    }
    const ctx: CalendarDayContext = { date: dateStr, isToday: dateStr === today, weekIndex: wi, dayIndex: di }
    const extra = dayProps?.(ctx) ?? {}
    return (
      <div
        key={`${wi}-${di}`}
        className={cn('p-2 min-h-[150px] flex flex-col', extra.className)}
        onClick={extra.onClick}
        onDragOver={extra.onDragOver}
        onDrop={extra.onDrop}
      >
        <div className='flex items-center justify-between mb-2'>
          <p className='text-[11px] font-medium text-foreground'>{parseInt(dateStr.split('-')[2], 10)}</p>
          <div className='flex items-center gap-1'>
            {dayHeaderExtra?.(ctx)}
            {ctx.isToday && <span className='text-[9px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center'>T</span>}
          </div>
        </div>
        {renderDay(ctx)}
      </div>
    )
  }

  const visibleWeeks = viewMode === 'month' ? weeks.map((w, wi) => ({ w, wi })) : [{ w: weeks[weekIndex] || [], wi: weekIndex }]

  return (
    <div>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4'>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={goToToday}>Hoy</Button>
          <div className='flex items-center'>
            <Button variant='outline' size='icon' className='rounded-r-none h-8 w-8' onClick={prev} aria-label='Anterior'><ChevronLeftIcon className='size-4' /></Button>
            <div className='h-8 px-3 border-y flex items-center text-sm font-medium min-w-[100px] justify-center bg-background'>
              {viewMode === 'week' ? formatWeekRange(weeks[weekIndex] || []) : `${CAL_MONTH_NAMES[month - 1]} ${year}`}
            </div>
            <Button variant='outline' size='icon' className='rounded-l-none h-8 w-8' onClick={next} aria-label='Siguiente'><ChevronRightIcon className='size-4' /></Button>
          </div>
        </div>
        <div className='flex items-center bg-muted rounded-lg p-1'>
          {(['week', 'month'] as const).map(m => (
            <button
              key={m}
              type='button'
              onClick={() => setViewMode(m)}
              className={cn('px-3 py-1 text-xs rounded-md transition-colors', viewMode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {m === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
        {legend && <div className='flex items-center gap-3 text-xs text-muted-foreground flex-wrap'>{legend}</div>}
      </div>

      {loading ? (
        <div className='flex items-center justify-center py-20'><div className='h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent' /></div>
      ) : !hasData ? (
        emptyState
      ) : (
        <div className='overflow-x-auto'>
          <div className='space-y-4 min-w-[700px]'>
            <div className='grid grid-cols-7 border-b'>
              {CAL_WEEKDAYS.map(d => <div key={d} className='py-2 text-center text-xs font-medium text-muted-foreground'>{d}</div>)}
            </div>
            {visibleWeeks.map(({ w, wi }) => (
              <div key={wi} className='rounded-lg border bg-card overflow-hidden'>
                <div className='grid grid-cols-7 divide-x'>{w.map((ds, di) => renderCell(ds, wi, di))}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
