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
// la ficha del cliente, /client-calendar, /client-meal-calendar y el «Calendario
// del programa» (modo `program`). Cualquier cambio de aspecto o de navegación
// (barra Hoy/‹ ›, vista Semana/Mes, cabecera de días, celdas, día actual...) se
// hace AQUÍ y se propaga a todos. Cada vista solo aporta el contenido de cada
// día (`renderDay`) y sus acciones.
//
// Dos modos de datos, mismo aspecto:
//  - Fechas reales (por defecto): `year`/`month`/`onMonthChange`.
//  - Programa (`program`): semanas de plantilla «Semana 1…N» sin fechas; la vista
//    controla la primera semana visible y pinta la cabecera de cada semana.

export type CalendarDayContext = {
  date: string
  isToday: boolean
  weekIndex: number
  dayIndex: number
  /** Solo en modo programa: nº de semana del programa (1-based). */
  weekNumber?: number
  /** Solo en modo programa: nº de día correlativo del programa (1-based). */
  programDay?: number
}

export type CalendarDayProps = {
  className?: string
  onClick?: MouseEventHandler<HTMLDivElement>
  onDragOver?: DragEventHandler<HTMLDivElement>
  onDrop?: DragEventHandler<HTMLDivElement>
}

export type ProgramCalendarConfig = {
  totalWeeks: number
  /** Primera semana visible (1-based). */
  startWeek: number
  onStartWeekChange: (startWeek: number) => void
  /** Semanas por página en vista Mes (4 por defecto); en vista Semana siempre 1. */
  weeksPerPage?: number
  /** Cabecera de cada semana (título, badge de descarga, acciones...). */
  weekHeader: (weekNumber: number) => ReactNode
  /** Clases extra del recuadro de la semana (p. ej. borde ámbar en descarga). */
  weekClassName?: (weekNumber: number) => string | undefined
}

type BaseProps = {
  loading?: boolean
  /** false → se muestra `emptyState` en vez de la cuadrícula. */
  hasData?: boolean
  emptyState?: ReactNode
  legend?: ReactNode
  renderDay: (ctx: CalendarDayContext) => ReactNode
  /**
   * Cabecera de cada fila de semana en modo FECHAS (rango, acciones de la
   * semana...). En modo programa la aporta `program.weekHeader`, que recibe el
   * nº de semana en vez de las fechas; `dates` son solo los días reales de la
   * fila (sin los huecos del inicio/fin de mes).
   */
  weekHeader?: (ctx: { weekIndex: number; dates: string[] }) => ReactNode
  /** Contenido extra a la derecha del número de día (p. ej. acciones de semana). */
  dayHeaderExtra?: (ctx: CalendarDayContext) => ReactNode
  dayProps?: (ctx: CalendarDayContext) => CalendarDayProps
}

type DateProps = BaseProps & {
  year: number
  month: number
  /** Se llama al navegar a otro mes (con los botones, "Hoy" o cruzando semana en vista Semana). */
  onMonthChange: (year: number, month: number) => void
  program?: undefined
}

type ProgramProps = BaseProps & {
  program: ProgramCalendarConfig
  year?: undefined
  month?: undefined
  onMonthChange?: undefined
}

type Props = DateProps | ProgramProps

const DAYS_PER_WEEK = 7

export function MonthWeekCalendar(props: Props) {
  const { loading = false, hasData = true, emptyState, legend, renderDay, weekHeader, dayHeaderExtra, dayProps, program } = props
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [weekIndexState, setWeekIndex] = useState(0)
  const year = props.year ?? 0
  const month = props.month ?? 1
  const weeks = useMemo(() => (program ? [] : getMonthWeeks(year, month)), [program, year, month])
  const weekIndex = Math.min(weekIndexState, Math.max(weeks.length - 1, 0))
  const today = getTodayStr()

  // ── Modo programa: paginación por semanas ────────────────────────────────
  const perPage = program?.weeksPerPage ?? 4
  const pageSize = viewMode === 'week' ? 1 : perPage
  const totalWeeks = program?.totalWeeks ?? 0
  const startWeek = program ? Math.min(Math.max(program.startWeek, 1), Math.max(totalWeeks, 1)) : 1
  const endWeek = program ? Math.min(startWeek + pageSize - 1, totalWeeks) : 0

  const goToToday = () => {
    if (!props.onMonthChange) return
    const n = new Date()
    props.onMonthChange(n.getFullYear(), n.getMonth() + 1)
    setWeekIndex(weekIndexOfDay(n.getFullYear(), n.getMonth() + 1, n.getDate()))
  }

  const prev = () => {
    if (program) {
      program.onStartWeekChange(Math.max(1, startWeek - pageSize))
      return
    }
    if (viewMode === 'week') {
      if (weekIndex > 0) { setWeekIndex(weekIndex - 1); return }
      const pm = month === 1 ? 12 : month - 1
      const py = month === 1 ? year - 1 : year
      props.onMonthChange?.(py, pm)
      setWeekIndex(getMonthWeeks(py, pm).length - 1)
      return
    }
    props.onMonthChange?.(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)
  }

  const next = () => {
    if (program) {
      program.onStartWeekChange(Math.min(Math.max(totalWeeks - pageSize + 1, 1), startWeek + pageSize))
      return
    }
    if (viewMode === 'week') {
      if (weekIndex < weeks.length - 1) { setWeekIndex(weekIndex + 1); return }
      props.onMonthChange?.(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)
      setWeekIndex(0)
      return
    }
    props.onMonthChange?.(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)
  }

  // Una celda de día: cabecera con el número (o «Día N» en modo programa) + contenido de la vista.
  const renderCell = (ctx: CalendarDayContext | null, key: string) => {
    if (!ctx) {
      return (
        <div key={key} className='p-2 min-h-[150px] flex flex-col bg-muted/30'>
          <p className='text-[11px] font-medium text-muted-foreground/50 mb-2'>—</p>
        </div>
      )
    }
    const extra = dayProps?.(ctx) ?? {}
    return (
      <div
        key={key}
        className={cn('p-2 min-h-[150px] flex flex-col', extra.className)}
        onClick={extra.onClick}
        onDragOver={extra.onDragOver}
        onDrop={extra.onDrop}
      >
        <div className='flex items-center justify-between mb-2'>
          <p className={cn('text-[11px] font-medium', program ? 'text-muted-foreground' : 'text-foreground')}>
            {program ? `Día ${ctx.programDay}` : parseInt(ctx.date.split('-')[2], 10)}
          </p>
          <div className='flex items-center gap-1'>
            {dayHeaderExtra?.(ctx)}
            {ctx.isToday && <span className='text-[9px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center'>T</span>}
          </div>
        </div>
        {renderDay(ctx)}
      </div>
    )
  }

  // Filas (semanas) a pintar, iguales en los dos modos: recuadro + (cabecera opcional) + 7 celdas.
  const rows: { key: string; className?: string; header?: ReactNode; cells: (CalendarDayContext | null)[] }[] = []
  if (program) {
    for (let wn = startWeek; wn <= endWeek; wn++) {
      rows.push({
        key: `p${wn}`,
        className: program.weekClassName?.(wn),
        header: program.weekHeader(wn),
        cells: Array.from({ length: DAYS_PER_WEEK }, (_, di) => ({
          date: '', isToday: false, weekIndex: wn - 1, dayIndex: di, weekNumber: wn, programDay: (wn - 1) * DAYS_PER_WEEK + di + 1,
        })),
      })
    }
  } else {
    const visible = viewMode === 'month' ? weeks.map((w, wi) => ({ w, wi })) : [{ w: weeks[weekIndex] || [], wi: weekIndex }]
    visible.forEach(({ w, wi }) => {
      rows.push({
        key: `d${wi}`,
        header: weekHeader?.({ weekIndex: wi, dates: w.filter((ds): ds is string => !!ds) }),
        cells: w.map((ds, di) => (ds ? { date: ds, isToday: ds === today, weekIndex: wi, dayIndex: di } : null)),
      })
    })
  }

  const centerLabel = program
    ? (viewMode === 'week' || startWeek === endWeek ? `Semana ${startWeek}` : `Semanas ${startWeek}–${endWeek} de ${totalWeeks}`)
    : (viewMode === 'week' ? formatWeekRange(weeks[weekIndex] || []) : `${CAL_MONTH_NAMES[month - 1]} ${year}`)
  const prevDisabled = program ? startWeek <= 1 : false
  const nextDisabled = program ? endWeek >= totalWeeks : false

  return (
    <div>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4'>
        <div className='flex items-center gap-2'>
          {!program && <Button variant='outline' size='sm' onClick={goToToday}>Hoy</Button>}
          <div className='flex items-center'>
            <Button variant='outline' size='icon' className='rounded-r-none h-8 w-8' onClick={prev} disabled={prevDisabled} aria-label='Anterior'><ChevronLeftIcon className='size-4' /></Button>
            <div className='h-8 px-3 border-y flex items-center text-sm font-medium min-w-[100px] justify-center bg-background'>
              {centerLabel}
            </div>
            <Button variant='outline' size='icon' className='rounded-l-none h-8 w-8' onClick={next} disabled={nextDisabled} aria-label='Siguiente'><ChevronRightIcon className='size-4' /></Button>
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
            {rows.map(row => (
              <div key={row.key} className={cn('rounded-lg border bg-card overflow-hidden', row.className)}>
                {row.header && <div className='border-b'>{row.header}</div>}
                <div className='grid grid-cols-7 divide-x'>
                  {row.cells.map((ctx, di) => renderCell(ctx, `${row.key}-${di}`))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
