// Mismo verde que emerald-500 (usado antes para "completado") — se usa como
// base del degradado para que el 100% se vea igual que el color binario que
// ya existía, sin romper nada visual.
const PROGRESS_RGB = '52,199,89'

/**
 * % del objetivo alcanzado ese día (0..1+). null = hábito binario (sin
 * target_value numérico) — esos siguen pintándose solo hecho/no-hecho.
 */
export function habitProgressRatio(
  valueLogged: number | string | null | undefined,
  targetValue: number | string | null | undefined
): number | null {
  if (targetValue === null || targetValue === undefined) return null
  const target = Number(targetValue)
  if (!target || Number.isNaN(target)) return null
  const value = valueLogged === null || valueLogged === undefined ? 0 : Number(valueLogged)
  if (Number.isNaN(value)) return 0
  return Math.max(0, value / target)
}

/**
 * Color de celda según % de cumplimiento — 5 tonos de intensidad creciente
 * (estilo GitHub contribution graph). Debe coincidir exactamente con
 * constants/habitColor.ts de la app móvil para que ambos lados se vean igual.
 */
export function habitCellColor(ratio: number | null, isCompleted: boolean): string | undefined {
  if (ratio === null) {
    return isCompleted ? `rgb(${PROGRESS_RGB})` : undefined
  }
  if (ratio >= 1) return `rgb(${PROGRESS_RGB})`
  if (ratio <= 0) return undefined
  const alpha = ratio < 0.25 ? 0.25 : ratio < 0.5 ? 0.45 : ratio < 0.75 ? 0.65 : 0.85
  return `rgba(${PROGRESS_RGB},${alpha})`
}
