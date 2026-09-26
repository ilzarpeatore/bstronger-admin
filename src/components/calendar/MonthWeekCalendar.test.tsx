import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MonthWeekCalendar } from './MonthWeekCalendar'

describe('MonthWeekCalendar', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 8, 25, 12)) })
  afterEach(() => { vi.useRealTimers() })

  it('pinta el mes, marca hoy y delega el contenido de cada día', () => {
    render(<MonthWeekCalendar year={2026} month={9} onMonthChange={() => {}} renderDay={({ date }) => <span>d-{date}</span>} />)
    expect(screen.getByText('Septiembre 2026')).toBeInTheDocument()
    expect(screen.getByText('d-2026-09-30')).toBeInTheDocument()
    expect(screen.getAllByText('T')).toHaveLength(1)
  })

  it('navega de mes con las flechas', async () => {
    const onMonthChange = vi.fn()
    render(<MonthWeekCalendar year={2026} month={12} onMonthChange={onMonthChange} renderDay={() => null} />)
    await userEvent.click(screen.getByLabelText('Siguiente'))
    expect(onMonthChange).toHaveBeenLastCalledWith(2027, 1)
    await userEvent.click(screen.getByLabelText('Anterior'))
    expect(onMonthChange).toHaveBeenLastCalledWith(2026, 11)
  })

  it('en vista Semana solo muestra una semana y cruza de mes al llegar al final', async () => {
    const onMonthChange = vi.fn()
    render(<MonthWeekCalendar year={2026} month={9} onMonthChange={onMonthChange} renderDay={({ date }) => <span>d-{date}</span>} />)
    await userEvent.click(screen.getByText('Semana'))
    expect(screen.queryByText('d-2026-09-30')).toBeNull()
    await userEvent.click(screen.getByText('Hoy'))
    expect(screen.getByText('d-2026-09-25')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Siguiente'))
    expect(screen.getByText('d-2026-09-30')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Siguiente'))
    expect(onMonthChange).toHaveBeenLastCalledWith(2026, 10)
  })

  it('muestra emptyState en vez de la cuadrícula cuando no hay datos', () => {
    render(<MonthWeekCalendar year={2026} month={9} onMonthChange={() => {}} hasData={false} emptyState={<p>vacío</p>} renderDay={() => null} />)
    expect(screen.getByText('vacío')).toBeInTheDocument()
    expect(screen.queryByText('Lun')).toBeNull()
  })

  describe('modo programa (semanas sin fechas)', () => {
    const weekHeader = (wn: number) => <div>Cabecera semana {wn}</div>

    it('pinta las semanas de la página con cabecera, «Día N» correlativo y los mismos nombres de día', () => {
      render(
        <MonthWeekCalendar
          program={{ totalWeeks: 6, startWeek: 1, onStartWeekChange: () => {}, weeksPerPage: 2, weekHeader }}
          renderDay={({ weekNumber, dayIndex }) => <span>w{weekNumber}d{dayIndex}</span>}
        />,
      )
      expect(screen.getByText('Semanas 1–2 de 6')).toBeInTheDocument()
      expect(screen.getByText('Cabecera semana 1')).toBeInTheDocument()
      expect(screen.getByText('Cabecera semana 2')).toBeInTheDocument()
      expect(screen.queryByText('Cabecera semana 3')).toBeNull()
      expect(screen.getByText('Lun')).toBeInTheDocument() // misma fila de días que los calendarios de fechas
      expect(screen.getByText('Día 1')).toBeInTheDocument()
      expect(screen.getByText('Día 8')).toBeInTheDocument() // primer día de la semana 2
      expect(screen.getByText('w2d6')).toBeInTheDocument()
      expect(screen.queryByText('Hoy')).toBeNull() // sin fechas no hay «Hoy»
    })

    it('las flechas avanzan por página y respetan los extremos', async () => {
      const onStartWeekChange = vi.fn()
      const { rerender } = render(
        <MonthWeekCalendar program={{ totalWeeks: 10, startWeek: 1, onStartWeekChange, weeksPerPage: 4, weekHeader }} renderDay={() => null} />,
      )
      expect(screen.getByLabelText('Anterior')).toBeDisabled()
      await userEvent.click(screen.getByLabelText('Siguiente'))
      expect(onStartWeekChange).toHaveBeenLastCalledWith(5)

      rerender(<MonthWeekCalendar program={{ totalWeeks: 10, startWeek: 5, onStartWeekChange, weeksPerPage: 4, weekHeader }} renderDay={() => null} />)
      await userEvent.click(screen.getByLabelText('Siguiente'))
      expect(onStartWeekChange).toHaveBeenLastCalledWith(7) // la última página muestra las 4 últimas semanas
      await userEvent.click(screen.getByLabelText('Anterior'))
      expect(onStartWeekChange).toHaveBeenLastCalledWith(1)

      rerender(<MonthWeekCalendar program={{ totalWeeks: 10, startWeek: 7, onStartWeekChange, weeksPerPage: 4, weekHeader }} renderDay={() => null} />)
      expect(screen.getByLabelText('Siguiente')).toBeDisabled()
    })

    it('la vista Semana muestra una sola semana y avanza de una en una', async () => {
      const onStartWeekChange = vi.fn()
      render(<MonthWeekCalendar program={{ totalWeeks: 6, startWeek: 3, onStartWeekChange, weekHeader }} renderDay={() => null} />)
      await userEvent.click(screen.getByText('Semana'))
      expect(screen.getByText('Cabecera semana 3')).toBeInTheDocument()
      expect(screen.queryByText('Cabecera semana 4')).toBeNull()
      await userEvent.click(screen.getByLabelText('Siguiente'))
      expect(onStartWeekChange).toHaveBeenLastCalledWith(4)
    })

    it('aplica clases y eventos por día, y la clase de cada semana', () => {
      const onDrop = vi.fn()
      render(
        <MonthWeekCalendar
          program={{ totalWeeks: 1, startWeek: 1, onStartWeekChange: () => {}, weekHeader, weekClassName: () => 'border-amber-400/60' }}
          renderDay={() => <span>x</span>}
          dayProps={({ dayIndex }) => (dayIndex === 0 ? { className: 'dia-especial', onDrop } : {})}
        />,
      )
      expect(document.querySelector('[class*="border-amber-400"]')).not.toBeNull()
      expect(document.querySelectorAll('.dia-especial')).toHaveLength(1)
    })

    it('muestra emptyState si no hay semanas', () => {
      render(
        <MonthWeekCalendar program={{ totalWeeks: 0, startWeek: 1, onStartWeekChange: () => {}, weekHeader }} hasData={false} emptyState={<p>sin semanas</p>} renderDay={() => null} />,
      )
      expect(screen.getByText('sin semanas')).toBeInTheDocument()
    })
  })
})
