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
})
