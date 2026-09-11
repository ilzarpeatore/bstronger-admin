/**
 * Categorías fijas para agrupar visualmente la biblioteca global de hábitos
 * — mismas 5 que traía la biblioteca hardcodeada original (Más Populares,
 * Estilo de Vida, Saludable, Mental, Vida Diaria), ahora como valor real
 * guardado en `habits.category` en vez de un array fijo en el frontend.
 */
export const HABIT_CATEGORIES = ['Más Populares', 'Estilo de Vida', 'Saludable', 'Mental', 'Vida Diaria'] as const
export type HabitCategory = (typeof HABIT_CATEGORIES)[number]
export const UNCATEGORIZED = 'Otros'

export function groupByCategory<T extends { category?: string | null }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = item.category || UNCATEGORIZED
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  const ordered: [string, T[]][] = []
  for (const cat of HABIT_CATEGORIES) {
    if (map.has(cat)) { ordered.push([cat, map.get(cat)!]); map.delete(cat) }
  }
  for (const [cat, items] of map) ordered.push([cat, items])
  return ordered
}
