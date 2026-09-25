// Helpers de fechas del calendario mensual/semanal compartido
// (components/calendar/MonthWeekCalendar.tsx). Todo en fecha LOCAL: nunca
// pasar por toISOString(), que en zonas horarias con offset negativo/positivo
// desplaza el día ("hoy" saldría marcado en el día equivocado).

export const CAL_WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const CAL_MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getTodayStr(): string {
  return toDateStr(new Date())
}

/** Parsea 'YYYY-MM-DD' como fecha local (new Date('YYYY-MM-DD') sería UTC). */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Celdas del mes, lunes primero: null para los huecos antes/después del mes. */
export function getMonthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month - 1, 1)
  const totalDays = new Date(year, month, 0).getDate()
  const startDay = (first.getDay() + 6) % 7
  const cells: (string | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function getMonthWeeks(year: number, month: number): (string | null)[][] {
  const cells = getMonthGrid(year, month)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Índice (0-based) de la semana del mes que contiene el día `day` (1-based). */
export function weekIndexOfDay(year: number, month: number, day: number): number {
  const startDay = (new Date(year, month - 1, 1).getDay() + 6) % 7
  return Math.floor((startDay + day - 1) / 7)
}

export function formatWeekRange(week: (string | null)[]): string {
  const dates = week.filter(Boolean) as string[]
  if (!dates.length) return ''
  const s = parseDateStr(dates[0])
  const e = parseDateStr(dates[dates.length - 1])
  const f = (d: Date) => d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
  return `${f(s)} - ${f(e)} ${e.getFullYear()}`
}
